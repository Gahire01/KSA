import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ReportTable } from "@/lib/reports/build";

/**
 * A report as a PDF: A4 landscape, logo + academy name + title + filter summary + date
 * on every first page, the table header repeated on each page, page numbers in the
 * footer. A PDF of thousands of rows is unreadable, so it is capped; the Excel export
 * carries every row.
 */

export const PDF_ROW_CAP = 1500;

const navy = "#0F2340";
const orange = "#E8590C";
const muted = "#4B5563";
const line = "#D8D3CB";

const styles = StyleSheet.create({
  page: { padding: 28, paddingBottom: 40, fontFamily: "Helvetica", fontSize: 8, color: "#1A1A1A" },
  brand: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  logo: { width: 40, height: 40, marginRight: 10 },
  org: { fontFamily: "Helvetica-Bold", fontSize: 13, color: navy, letterSpacing: 1.2 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 11, color: orange, marginTop: 2 },
  meta: { fontSize: 8, color: muted, marginBottom: 1 },
  tableHeader: { flexDirection: "row", backgroundColor: navy, color: "#FFFFFF", paddingVertical: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: line, paddingVertical: 3 },
  rowAlt: { backgroundColor: "#F8F6F2" },
  cell: { paddingHorizontal: 3 },
  right: { textAlign: "right" },
  footer: { position: "absolute", bottom: 14, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: muted },
  note: { marginTop: 8, fontSize: 8, color: orange },
});

let logoSrc: string | null | undefined;
function logo(): string | null {
  if (logoSrc === undefined) {
    try {
      logoSrc = `data:image/png;base64,${readFileSync(join(process.cwd(), "public", "logo.png")).toString("base64")}`;
    } catch {
      logoSrc = null;
    }
  }
  return logoSrc;
}

/** Derived from the library's own `Document`, as the certificate does, so renderToBuffer accepts the element. */
type ReactPdfDocumentProps = React.ComponentProps<typeof Document>;

export function ReportDocument({
  table,
  generatedAt,
}: ReactPdfDocumentProps & { table: ReportTable; generatedAt: Date }) {
  const total = table.columns.reduce((sum, c) => sum + c.width, 0);
  const widthOf = (i: number) => `${((table.columns[i]?.width ?? 10) / total) * 100}%`;
  const capped = table.rows.length > PDF_ROW_CAP;
  const rows = capped ? table.rows.slice(0, PDF_ROW_CAP) : table.rows;
  const src = logo();

  return (
    <Document title={`${table.title} · Kigali Safety Academy`} author="Kigali Safety Academy">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.brand}>
          {src ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
            <Image src={src} style={styles.logo} />
          ) : null}
          <View>
            <Text style={styles.org}>KIGALI SAFETY ACADEMY</Text>
            <Text style={styles.title}>{table.title}</Text>
          </View>
        </View>

        {table.filterSummary.map((l) => (
          <Text key={l} style={styles.meta}>
            {l}
          </Text>
        ))}
        <Text style={[styles.meta, { marginBottom: 8 }]}>
          Generated {generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {table.rows.length} rows
        </Text>

        <View style={styles.tableHeader} fixed>
          {table.columns.map((c, i) => (
            <Text key={c.header} style={[styles.cell, { width: widthOf(i) }, c.align === "right" ? styles.right : {}]}>
              {c.header}
            </Text>
          ))}
        </View>

        {rows.map((values, r) => (
          <View key={r} style={r % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row} wrap={false}>
            {values.map((value, i) => (
              <Text
                key={i}
                style={[styles.cell, { width: widthOf(i) }, table.columns[i]?.align === "right" ? styles.right : {}]}
              >
                {typeof value === "number" && /RWF/.test(table.columns[i]?.header ?? "")
                  ? value.toLocaleString("en-US")
                  : String(value)}
              </Text>
            ))}
          </View>
        ))}

        {rows.length === 0 ? <Text style={styles.note}>No rows match these filters.</Text> : null}
        {capped ? (
          <Text style={styles.note}>
            Showing the first {PDF_ROW_CAP} of {table.rows.length} rows. Export to Excel for the complete list.
          </Text>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>Kigali Safety Academy · {table.title}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
