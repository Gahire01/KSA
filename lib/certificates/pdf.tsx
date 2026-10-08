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
 * Layout (kept identical to the on-screen preview in app/(app)/certificates/[id]):
 *   top     logo top-right; KIGALI SAFETY ACADEMY centred; orange divider
 *   centre  "This is to certify that", trainee name, the completion line, the
 *           course in capitals, the topics covered
 *   bottom  signature block (left) | one line: Student#, Issued, Duration
 *           (centre) | QR code to the verify page (bottom-right, uncaptioned)
 *
 * Sizes are the web spec's pixels converted to PDF points (x 0.75). There is no
 * expiry, "valid until" or revoked marking anywhere on it: a certificate does not
 * lapse, and revocation is shown on the public verification page.
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
  /** SHA-256 of the frozen certificate snapshot (Certificate.contentHash). */
  contentHash: string;
}

const palette = {
  ink: "#1A1A1A",
  ink2: "#4B5563",
  navy: "#0F2340",
  orange: "#E8590C",
  line: "#D8D3CB",
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
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 28,
  },
  logo: { position: "absolute", top: 14, right: 20, width: 60, height: 60 },
  org: {
    fontFamily: "Helvetica-Bold",
    fontSize: 21,
    letterSpacing: 2.5,
    color: palette.navy,
    marginTop: 26,
  },
  divider: { width: 90, height: 1, backgroundColor: palette.orange, marginTop: 8 },
  certifies: { fontSize: 10.5, color: palette.ink2, marginTop: 18 },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 25.5,
    color: palette.navy,
    marginTop: 8,
    textAlign: "center",
  },
  body: { fontSize: 10.5, color: palette.ink2, textAlign: "center", marginTop: 10, maxWidth: 560 },
  course: {
    fontFamily: "Helvetica-Bold",
    fontSize: 19.5,
    color: palette.orange,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 640,
  },
  topics: { fontSize: 8.25, color: palette.ink2, textAlign: "center", marginTop: 10, maxWidth: 540 },
  bottom: {
    marginTop: "auto",
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  /* Left and right take equal space so the centre line is truly centred. */
  colLeft: { flex: 1, alignItems: "flex-start" },
  colCenter: { alignItems: "center", paddingBottom: 2 },
  colRight: { flex: 1, alignItems: "flex-end" },
  /* The 45pt band is the 60px signature height; bottom-aligned so the line sits on
   * one baseline whether or not an image is present. */
  signatureBlock: { width: 180 },
  signatureBand: { height: 45, width: 180, justifyContent: "flex-end", alignItems: "center" },
  signatureImage: { maxWidth: 180, maxHeight: 45, objectFit: "contain" },
  signatureLine: { width: 180, height: 1.5, backgroundColor: palette.ink },
  signatureName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    color: palette.navy,
    marginTop: 3,
    textAlign: "center",
    width: 180,
  },
  signatureTitle: { fontSize: 8.5, color: palette.ink2, marginTop: 1, textAlign: "center", width: 180 },
  qr: { width: 67.5, height: 67.5 },
  factLine: { fontSize: 8.25, color: palette.ink2 },
  factStrong: { fontFamily: "Helvetica-Bold", color: palette.navy },
  footer: { position: "absolute", bottom: 8, left: 28, right: 28, alignItems: "center" },
  /* 7px at the x 0.75 scale, monospaced: a quiet line that ties a copy to its holder. */
  footerText: { fontFamily: "Courier", fontSize: 5.25, color: palette.ink2 },
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

            <View style={styles.bottom}>
              <View style={styles.colLeft}>
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
              </View>

              <View style={styles.colCenter}>
                <Text style={styles.factLine}>
                  Student# <Text style={styles.factStrong}>{doc.studentNumber}</Text>
                  {"   ·   "}Issued <Text style={styles.factStrong}>{formatDate(doc.issuedAt)}</Text>
                  {"   ·   "}Duration <Text style={styles.factStrong}>{doc.duration}</Text>
                </Text>
              </View>

              <View style={styles.colRight}>
                {doc.qrSrc ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
                  <Image src={doc.qrSrc} style={styles.qr} />
                ) : null}
              </View>
            </View>
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
