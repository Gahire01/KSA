import { siteBaseUrl } from "@/lib/site";
import { ACADEMY } from "@/lib/academy/constants";

/**
 * llms.txt — a plain-text index for LLM crawlers.
 *
 * Absolute links are included once a real public origin exists; before that the
 * document stands alone with paths only, and never mentions a made-up domain.
 */
export const dynamic = "force-static";

export async function GET() {
  const base = siteBaseUrl();
  const abs = (path: string) => (base ? `${base}${path}` : path);

  const body = [
    `# ${ACADEMY.name}`,
    ``,
    `> ${ACADEMY.tagline}`,
    ``,
    `${ACADEMY.name} (${ACADEMY.shortName}) of ${ACADEMY.city}, ${ACADEMY.country} runs training, examination and certification. The signed-in console manages trainees, courses, exams, certificates and payments. The public surfaces are certificate verification and the legal pages listed below.`,
    ``,
    `## Public pages`,
    ``,
    `- [Certificate verification](${abs("/verify")}): confirm a certificate is authentic and current by pasting its printed token.`,
    `- [Privacy policy](${abs("/privacy")}): what personal data is collected and why.`,
    `- [Terms of service](${abs("/terms")}): rules for using the platform.`,
    `- [Cookie policy](${abs("/cookies")}): the essential cookies the site sets.`,
    `- [Refund policy](${abs("/refund-policy")}): when course fees are refunded.`,
    ``,
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}