import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The printed certificate.
 *
 * Built from the **snapshot** columns, never from the live course and trainee rows.
 * A course retitled or a trainee renamed next month must not change a certificate
 * somebody is already holding, so everything printed here is frozen at issue time.
 *
 * Fonts are registered from files on disk rather than fetched over the network: a
 * PDF render must not depend on Google Fonts being reachable, and a cold render
 * should not block on it.
 */

export interface CertificateDoc {
  studentNumber: number;
  traineeName: string;
  courseName: string;
  topics: string[];
  duration: string;
  issuedAt: Date;
  expiresAt: Date | null;
  trainerName: string;
  trainerTitle: string;
  directorName: string;
  directorTitle: string;
  verifyUrl: string;
  status: string;
}

const palette = {
  ink: "#1A1A1A",
  ink2: "#4B5563",
  line: "#D8D3CB",
  green: "#166534",
  red: "#B91C1C",
  paper: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: palette.paper,
    paddingTop: 46,
    paddingBottom: 54,
    paddingHorizontal: 46,
    fontFamily: "Helvetica",
    color: palette.ink,
  },
  frame: {
    borderWidth: 2,
    borderColor: palette.green,
    paddingTop: 34,
    paddingBottom: 30,
    paddingHorizontal: 30,
    height: "100%",
  },
  innerFrame: {
    borderWidth: 0.5,
    borderColor: palette.line,
    flex: 1,
    alignItems: "center",
    paddingTop: 26,
    paddingHorizontal: 22,
  },
  org: { fontSize: 11, letterSpacing: 2.4, color: palette.ink2 },
  title: { fontSize: 25, marginTop: 12, letterSpacing: 1.2 },
  rule: {
    width: 74,
    height: 1.5,
    backgroundColor: palette.green,
    marginTop: 14,
    marginBottom: 22,
  },
  certifies: { fontSize: 10.5, color: palette.ink2 },
  name: { fontSize: 21, marginTop: 9 },
  lineUnderName: {
    width: "72%",
    height: 0.5,
    backgroundColor: palette.line,
    marginTop: 6,
    marginBottom: 16,
  },
  body: { fontSize: 10.5, color: palette.ink2, textAlign: "center", maxWidth: 400 },
  course: { fontSize: 15, marginTop: 14, textAlign: "center" },
  topics: {
    marginTop: 12,
    fontSize: 10,
    color: palette.ink2,
    textAlign: "center",
    maxWidth: 420,
  },
  facts: {
    marginTop: 20,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fact: { alignItems: "center", flex: 1 },
  factLabel: {
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: palette.ink2,
    textTransform: "uppercase",
  },
  factValue: { fontSize: 10.5, marginTop: 4 },
  signatures: {
    marginTop: "auto",
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 18,
  },
  signature: { width: "42%", alignItems: "center" },
  signatureLine: {
    width: "100%",
    height: 0.5,
    backgroundColor: palette.line,
    marginBottom: 6,
  },
  signatureName: { fontSize: 10.5 },
  signatureTitle: { fontSize: 8.5, color: palette.ink2, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 46,
    right: 46,
    alignItems: "center",
  },
  footerText: { fontSize: 7.5, color: palette.ink2 },
  verifyToken: { fontSize: 7, color: palette.ink2, marginTop: 3 },
  revoked: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: palette.red,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  revokedText: { fontSize: 10, color: palette.red, letterSpacing: 1.6 },
});

/**
 * Registers the fonts once per process.
 *
 * Helvetica is react-pdf's built-in and needs no file, so a missing local font is a
 * graceful fallback to the base-14 set rather than a failed render.
 */
let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;

  const candidates = [
    { family: "Inter", files: ["Inter-Regular.ttf", "Inter-SemiBold.ttf"] },
  ];

  for (const { family, files } of candidates) {
    for (const file of files) {
      const path = join(process.cwd(), "public", "fonts", file);
      try {
        Font.register({
          family,
          src: readFileSync(path).toString("base64"),
        });
        break;
      } catch {
        /* Not shipped in this deployment — Helvetica stands in. */
      }
    }
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Derived from the library's own `Document` so it cannot drift from the real props. */
type ReactPdfDocumentProps = React.ComponentProps<typeof Document>;

export function CertificateDocument({
  doc,
}: ReactPdfDocumentProps & { doc: CertificateDoc }) {
  registerFonts();

  const revoked = doc.status === "REVOKED";
  const accent = revoked ? palette.red : palette.green;

  return (
    <Document
      title={`Certificate ${doc.studentNumber}`}
      author="Kigali Safety Academy"
      subject={doc.courseName}
      keywords={`certificate,${doc.studentNumber},ksa`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={[styles.frame, { borderColor: accent }]}>
          <View style={styles.innerFrame}>
            <Text style={styles.org}>KIGALI SAFETY ACADEMY</Text>
            <Text style={styles.title}>CERTIFICATE OF COMPLETION</Text>
            <View style={[styles.rule, { backgroundColor: accent }]} />

            <Text style={styles.certifies}>This certifies that</Text>
            <Text style={styles.name}>{doc.traineeName}</Text>
            <View style={styles.lineUnderName} />

            <Text style={styles.body}>
              has successfully completed all requirements for
            </Text>
            <Text style={styles.course}>{doc.courseName}</Text>
            {doc.topics.length > 0 ? (
              <Text style={styles.topics}>Covering: {doc.topics.join(" · ")}</Text>
            ) : null}

            <View style={styles.facts}>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Student number</Text>
                <Text style={styles.factValue}>{doc.studentNumber}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Duration</Text>
                <Text style={styles.factValue}>{doc.duration}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Issued</Text>
                <Text style={styles.factValue}>{formatDate(doc.issuedAt)}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Valid until</Text>
                <Text style={styles.factValue}>
                  {doc.expiresAt ? formatDate(doc.expiresAt) : "No expiry"}
                </Text>
              </View>
            </View>

            {revoked ? (
              <View style={styles.revoked}>
                <Text style={styles.revokedText}>REVOKED — NOT VALID</Text>
              </View>
            ) : null}

            <View style={styles.signatures}>
              <View style={styles.signature}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>{doc.trainerName}</Text>
                <Text style={styles.signatureTitle}>{doc.trainerTitle}</Text>
              </View>
              <View style={styles.signature}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>{doc.directorName}</Text>
                <Text style={styles.signatureTitle}>{doc.directorTitle}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Verify this certificate at {doc.verifyUrl}
          </Text>
          <Text style={styles.verifyToken}>
            Student number {doc.studentNumber} · issued{" "}
            {doc.issuedAt.toISOString().slice(0, 10)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
