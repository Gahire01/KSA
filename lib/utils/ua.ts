/**
 * A deliberately small user-agent parser.
 *
 * The sessions list only needs to answer "which browser on which OS", and a
 * full UA-capability library would be a large dependency for two words of copy.
 * Unknown agents degrade to a generic label rather than the raw string, so an
 * odd or spoofed agent cannot inject markup into the list.
 */

export interface ParsedAgent {
  /** "iPhone", "Windows PC", "MacBook", ... */
  device: string;
  /** "Chrome", "Safari", "Firefox", "Edge", ... */
  browser: string;
  /** "iOS", "Android", "Windows", "macOS", "Linux", ... */
  os: string;
}

const BROWSERS: Array<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//i, "Edge"],
  [/\bOPR\/|\bOpera\//i, "Opera"],
  [/\bSamsungBrowser\//i, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//i, "Firefox"],
  [/\bChrome\/|\bCriOS\//i, "Chrome"],
  [/\bSafari\//i, "Safari"],
  [/\bHeadlessChrome\//i, "Chrome"],
  [/\bcurl\//i, "curl"],
  [/\bwget\//i, "Wget"],
];

const PLATFORMS: Array<[RegExp, string]> = [
  [/\bWindows NT 10/i, "Windows"],
  [/\bWindows NT/i, "Windows"],
  [/\biPhone\b|\biPad\b|\biPod\b/i, "iOS"],
  [/\bAndroid\b/i, "Android"],
  [/\bMac OS X\b|\bMacintosh\b/i, "macOS"],
  [/\bCrOS\b/i, "ChromeOS"],
  [/\bLinux\b/i, "Linux"],
];

function deviceLabel(ua: string, os: string): string {
  if (/\biPad\b/i.test(ua)) return "iPad";
  if (/\biPhone\b/i.test(ua)) return "iPhone";
  if (/\bAndroid\b/i.test(ua) && /\bMobile\b/i.test(ua)) return "Android phone";
  if (/\bAndroid\b/i.test(ua)) return "Android tablet";
  if (os === "Windows") return "Windows PC";
  if (os === "macOS") return /Macintosh/i.test(ua) ? "Mac" : "Mac";
  if (os === "ChromeOS") return "Chromebook";
  if (os === "Linux") return "Linux PC";
  return "Unknown device";
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedAgent {
  const ua = userAgent?.trim() ?? "";

  if (!ua) {
    return { device: "Unknown device", browser: "Unknown browser", os: "Unknown OS" };
  }

  const os = PLATFORMS.find(([re]) => re.test(ua))?.[1] ?? "Unknown OS";
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? "Unknown browser";

  return { device: deviceLabel(ua, os), browser, os };
}
