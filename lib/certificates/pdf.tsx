import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The printed certificate (A4 landscape, 842 x 595 pt).
 *
 * Built from the **snapshot** columns, never from the live course and trainee rows.
 * A course retitled or a trainee renamed next month must not change a certificate
 * somebody is already holding, so everything printed here is frozen at issue time.
 *
 * Layout (kept identical to the on-screen preview in components/certificate/CertificateSheet):
 *   top     large centred logo (and a faint copy behind the page as a watermark)
 *   centre  italic "This is to certify that", the trainee's name on a ruled line, the
 *           italic completion line, the course in capitals, a left-aligned topics paragraph
 *   bottom  signature block (left) | Student# / Issued / Duration as value-over-label
 *           with the uncaptioned QR code beneath (right) | a thin certificate-ID line
 *   foot    "Issued to {name} · Student #{n}" in 7px mono, outside the frame
 *
 * Sizes are the web design's pixels converted to PDF points (x 0.75). There is no
 * expiry, "valid until" or revoked marking anywhere on it: a certificate does not
 * lapse, and revocation is shown on the public verification page.
 *
 * Fonts are the built-in Helvetica/Times/Courier families, so a render never depends on
 * the network or on a font file being shipped.
 */

export interface CertificateDoc {
  studentNumber: number;
  traineeName: string;
  courseName: string;
  topics: string[];
  duration: string;
  issuedAt: Date;
  directorName: string;
  directorTitle: string;
  /** Data URI of the snapshotted signature. undefined = legacy static asset; null = none. */
  signatureSrc?: string | null;
  /** Data URI (PNG) of the QR code for `verifyUrl`. */
  qrSrc?: string | null;
  verifyUrl: string;
  /** SHA-256 of the frozen certificate snapshot (Certificate.contentHash). */
  contentHash: string;
}

const palette = {
  ink: "#1A1A1A",
  ink2: "#4B5563",
  navy: "#0F2340",
  orange: "#E8590C",
  line: "#9CA3AF",
  paper: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: palette.paper,
    padding: 28,
    fontFamily: "Helvetica",
    color: palette.ink,
  },
  /* Navy 2px outer border; the thin orange one sits inside it. */
  frame: {
    borderWidth: 1.5,
    borderColor: palette.navy,
    padding: 10,
    flex: 1,
  },
  innerFrame: {
    borderWidth: 0.75,
    borderColor: palette.orange,
    flex: 1,
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 36,
  },
  /* Faint centred logo behind everything, as on the reference sample. */
  watermark: { position: "absolute", top: 120, left: 280, width: 200, height: 200, opacity: 0.06 },
  logo: { width: 82, height: 82 },
  certifies: { fontFamily: "Times-Italic", fontSize: 10.5, color: palette.ink2, marginTop: 10 },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 25.5,
    color: palette.navy,
    marginTop: 4,
    textAlign: "center",
    width: "100%",
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: palette.line,
  },
  body: { fontFamily: "Times-Italic", fontSize: 10.5, color: palette.ink2, textAlign: "center", marginTop: 10, maxWidth: 560 },
  course: {
    fontFamily: "Helvetica-Bold",
    fontSize: 19.5,
    color: palette.orange,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 640,
  },
  topics: { fontSize: 8.25, color: palette.ink2, textAlign: "justify", marginTop: 12, width: "100%", lineHeight: 1.45 },
  bottom: {
    marginTop: "auto",
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  /* The 45pt band is the 60px signature height; bottom-aligned so the line sits on
   * one baseline whether or not an image is present. */
  signatureBlock: { width: 180 },
  signatureBand: { height: 45, width: 180, justifyContent: "flex-end", alignItems: "center" },
  signatureImage: { maxWidth: 180, maxHeight: 45, objectFit: "contain" },
  signatureLine: { width: 180, height: 1.5, backgroundColor: palette.ink },
  signatureName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: palette.navy, marginTop: 3, width: 180 },
  signatureTitle: { fontSize: 8.5, color: palette.ink2, marginTop: 1, width: 180 },
  right: { alignItems: "flex-end" },
  facts: { flexDirection: "row", width: 240 },
  fact: { flex: 1, alignItems: "center", marginLeft: 12 },
  factValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: palette.navy,
    width: "100%",
    textAlign: "center",
    paddingBottom: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.line,
  },
  factLabel: { fontSize: 7.5, color: palette.ink2, marginTop: 2 },
  qr: { width: 67.5, height: 67.5, marginTop: 8 },
  certId: { fontFamily: "Courier", fontSize: 6, color: "#6B7280", width: "100%", marginTop: 8 },
  footer: { position: "absolute", bottom: 8, left: 28, right: 28, alignItems: "center" },
  /* 7px at the x 0.75 scale, monospaced: a quiet line that ties a copy to its holder. */
  footerText: { fontFamily: "Courier", fontSize: 5.25, color: palette.ink2 },
});

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * Brand assets embedded as data URIs. Read from disk once per process: a PDF
 * render must not fetch over the network, and a missing file falls back to no
 * image rather than a failed render.
 */
type Asset = { src: string } | null;

function loadAsset(relativePath: string): Asset {
  try {
    const data = readFileSync(join(process.cwd(), "public", relativePath));
    const ext = relativePath.split(".").pop()?.toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    return { src: `data:${mime};base64,${data.toString("base64")}` };
  } catch {
    return null;
  }
}

let logoAsset: Asset | undefined;
let signatureAsset: Asset | undefined;

function getLogo(): Asset {
  if (logoAsset === undefined) logoAsset = loadAsset("logo.png");
  return logoAsset;
}

function getSignature(): Asset {
  if (signatureAsset === undefined) signatureAsset = loadAsset("certificate/signature.png");
  return signatureAsset;
}

/** Derived from the library's own `Document` so it cannot drift from the real props. */
type ReactPdfDocumentProps = React.ComponentProps<typeof Document>;

export function CertificateDocument({
  doc,
}: ReactPdfDocumentProps & { doc: CertificateDoc }) {
  const logo = getLogo();
  const signature: Asset =
    doc.signatureSrc === undefined
      ? getSignature()
      : doc.signatureSrc === null
        ? null
        : { src: doc.signatureSrc };

  const facts: Array<[string, string]> = [
    [String(doc.studentNumber), "Student #"],
    [formatDate(doc.issuedAt), "Issued"],
    [doc.duration, "Duration"],
  ];

  return (
    <Document
      title={`Certificate ${doc.studentNumber}`}
      author="Kigali Safety Academy"
      /* The SHA-256 of the certificate's frozen snapshot: the same value /verify shows,
       * so a PDF can be matched to the register without trusting its look. */
      subject={doc.contentHash}
      keywords={`certificate,${doc.studentNumber},ksa`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.innerFrame}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={logo.src} style={styles.watermark} />
            ) : null}
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={logo.src} style={styles.logo} />
            ) : null}

            <Text style={styles.certifies}>This is to certify that</Text>
            <Text style={styles.name}>{doc.traineeName}</Text>
            <Text style={styles.body}>
              Has successfully completed KSAcademy occupational Health and Safety Course in
            </Text>
            <Text style={styles.course}>{doc.courseName}</Text>
            {doc.topics.length > 0 ? (
              <Text style={styles.topics}>Topics covered : {doc.topics.join(" , ")}</Text>
            ) : null}

            <View style={styles.bottom}>
              <View style={styles.signatureBlock}>
                <View style={styles.signatureBand}>
                  {signature ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
                    <Image src={signature.src} style={styles.signatureImage} />
                  ) : null}
                </View>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>{doc.directorName}</Text>
                <Text style={styles.signatureTitle}>{doc.directorTitle}</Text>
              </View>

              <View style={styles.right}>
                <View style={styles.facts}>
                  {facts.map(([value, label]) => (
                    <View key={label} style={styles.fact}>
                      <Text style={styles.factValue}>{value}</Text>
                      <Text style={styles.factLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
                {doc.qrSrc ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
                  <Image src={doc.qrSrc} style={styles.qr} />
                ) : null}
              </View>
            </View>

            <Text style={styles.certId}>
              Certificate ID: {doc.studentNumber}-{doc.contentHash.slice(0, 12).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Issued to {doc.traineeName} · Student #{doc.studentNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
