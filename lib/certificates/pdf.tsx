import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The printed certificate (A4 landscape, 842 x 595 pt).
 *
 * Built from the **snapshot** columns, never from the live course and trainee rows.
 * A course retitled or a trainee renamed next month must not change a certificate
 * somebody is already holding, so everything printed here is frozen at issue time.
 *
 * Layout:
 *   top     logo, KIGALI SAFETY ACADEMY, divider
 *   centre  "This is to certify that", trainee name, the completion line, the
 *           course in capitals, the topics covered
 *   bottom  three columns: signature block | QR code to the verify page |
 *           student number, issue date, duration
 *
 * Sizes are the web spec's pixels converted to PDF points (x 0.75). There is no
 * expiry anywhere on it: a certificate does not lapse.
 *
 * Fonts are the built-in Helvetica family, so a render never depends on the
 * network or on a font file being shipped.
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
  status: string;
}

const palette = {
  ink: "#1A1A1A",
  ink2: "#4B5563",
  navy: "#0F2340",
  orange: "#E8590C",
  line: "#D8D3CB",
  green: "#166534",
  red: "#B91C1C",
  paper: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: palette.paper,
    padding: 28,
    fontFamily: "Helvetica",
    color: palette.ink,
  },
  frame: {
    borderWidth: 2,
    borderColor: palette.green,
    padding: 14,
    flex: 1,
  },
  innerFrame: {
    borderWidth: 0.5,
    borderColor: palette.line,
    flex: 1,
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 28,
  },
  logo: { width: 60, height: 60 },
  org: {
    fontFamily: "Helvetica-Bold",
    fontSize: 21,
    letterSpacing: 1.6,
    color: palette.navy,
    marginTop: 8,
  },
  divider: { width: 90, height: 1, backgroundColor: palette.line, marginTop: 8 },
  certifies: { fontSize: 11, color: palette.ink2, marginTop: 14 },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 26,
    color: palette.navy,
    marginTop: 6,
    textAlign: "center",
  },
  body: { fontSize: 11, color: palette.ink2, textAlign: "center", marginTop: 10, maxWidth: 560 },
  course: {
    fontFamily: "Helvetica-Bold",
    fontSize: 17,
    color: palette.orange,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 640,
  },
  topics: { fontSize: 10, color: palette.ink2, textAlign: "center", marginTop: 10, maxWidth: 640 },
  revoked: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: palette.red,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  revokedText: { fontSize: 10, color: palette.red, letterSpacing: 1.6 },
  bottom: {
    marginTop: "auto",
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  colLeft: { width: "32%", alignItems: "center" },
  colCenter: { width: "24%", alignItems: "center" },
  colRight: { width: "32%", alignItems: "flex-end" },
  /* Both signature columns reserve the same 60pt band, bottom-aligned, so the
   * signature line sits on one baseline whether or not an image is present. */
  signatureBand: { height: 45, width: 135, justifyContent: "flex-end", alignItems: "center" },
  signatureImage: { maxWidth: 135, maxHeight: 45, objectFit: "contain" },
  signatureLine: { width: "100%", height: 0.5, backgroundColor: palette.ink2, marginBottom: 4 },
  signatureName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: palette.navy },
  signatureTitle: { fontSize: 8.5, color: palette.ink2, marginTop: 2 },
  qr: { width: 66, height: 66 },
  qrLabel: { fontSize: 7, color: palette.ink2, marginTop: 3, letterSpacing: 0.8 },
  factLine: { fontSize: 10, color: palette.ink2, marginTop: 3 },
  factStrong: { fontFamily: "Helvetica-Bold", color: palette.navy },
  footer: { position: "absolute", bottom: 8, left: 28, right: 28, alignItems: "center" },
  footerText: { fontSize: 7, color: palette.ink2 },
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
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * Brand assets embedded as data URIs. Read from disk once per process: a PDF
 * render must not fetch over the network, and a missing file falls back to no
 * image rather than a failed render.
 */
type Asset = { src: string; width: number; height: number } | null;

function loadAsset(relativePath: string): Asset {
  try {
    const data = readFileSync(join(process.cwd(), "public", relativePath));
    const ext = relativePath.split(".").pop()?.toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    return {
      src: `data:${mime};base64,${data.toString("base64")}`,
      width: 0,
      height: 0,
    };
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
  registerFonts();

  const revoked = doc.status === "REVOKED";
  const accent = revoked ? palette.red : palette.green;
  const logo = getLogo();
  const signature: Asset =
    doc.signatureSrc === undefined
      ? getSignature()
      : doc.signatureSrc === null
        ? null
        : { src: doc.signatureSrc, width: 0, height: 0 };

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
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={logo.src} style={styles.logo} />
            ) : null}
            <Text style={styles.org}>KIGALI SAFETY ACADEMY</Text>
            <View style={styles.divider} />

            <Text style={styles.certifies}>This is to certify that</Text>
            <Text style={styles.name}>{doc.traineeName}</Text>
            <Text style={styles.body}>
              Has successfully completed KSAcademy occupational Health and Safety Course in
            </Text>
            <Text style={styles.course}>{doc.courseName}</Text>
            {doc.topics.length > 0 ? (
              <Text style={styles.topics}>Topics covered : {doc.topics.join(" , ")}</Text>
            ) : null}

            {revoked ? (
              <View style={styles.revoked}>
                <Text style={styles.revokedText}>REVOKED — NOT VALID</Text>
              </View>
            ) : null}

            <View style={styles.bottom}>
              <View style={styles.colLeft}>
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

              <View style={styles.colCenter}>
                {doc.qrSrc ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
                  <Image src={doc.qrSrc} style={styles.qr} />
                ) : null}
                <Text style={styles.qrLabel}>SCAN TO VERIFY</Text>
              </View>

              <View style={styles.colRight}>
                <Text style={styles.factLine}>
                  Student <Text style={styles.factStrong}>#{doc.studentNumber}</Text>
                </Text>
                <Text style={styles.factLine}>
                  Issued <Text style={styles.factStrong}>{formatDate(doc.issuedAt)}</Text>
                </Text>
                <Text style={styles.factLine}>
                  Duration <Text style={styles.factStrong}>{doc.duration}</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Verify this certificate at {doc.verifyUrl}</Text>
        </View>
      </Page>
    </Document>
  );
}
