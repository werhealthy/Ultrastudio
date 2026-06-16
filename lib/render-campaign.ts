import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { TEMPLATE_01_LAYOUT } from "@/lib/template-layout";

export type CampaignRenderPayload = {
  subjectImageDataUrl?: string;
  subjectImageUrl?: string;
  subjectImageBuffer?: Buffer;
  headline?: string;
  priceLeft?: string;
  priceRight?: string;
  pricePeriod?: string;
  cta?: string;
  legalNotes?: string;
  legalNotice?: string;
  outputFileName?: string;
};

const PLACEHOLDER_COPY = {
  headline: "Lorem ipsum dolor sit amet",
  priceLeft: "XX",
  priceRight: ",XX €",
  pricePeriod: "Lorem ipsum dolor sit amet lorecul amet",
  cta: "Lorem ipsum dolor sit",
  legalNotes: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
};

export function generatedDir() {
  return path.join(process.cwd(), "public", "generated");
}

export function assetUrl(fileName: string) {
  return `/api/figma/asset/${fileName}`;
}

function fileUrl(possiblePaths: string[]) {
  for (const rel of possiblePaths) {
    // SVG renderers can load local font files via file:// URLs.
    return `file://${path.join(process.cwd(), rel).replace(/\\/g, "/")}`;
  }
  return "";
}

function fontFaceCss() {
  return `
    @font-face {
      font-family: 'TIM Sans Render';
      src: url('${fileUrl(["public/fonts/TIMSans-Heavy.ttf"])}') format('truetype');
      font-weight: 900;
    }
    @font-face {
      font-family: 'TIM Sans Render';
      src: url('${fileUrl(["public/fonts/TIMSans-Bold.ttf"])}') format('truetype');
      font-weight: 700;
    }
  `;
}

async function readFirstExisting(paths: string[]) {
  for (const rel of paths) {
    try {
      return await readFile(path.join(process.cwd(), rel));
    } catch {
      // try next
    }
  }
  return null;
}

async function readTemplate() {
  const sharp = (await import("sharp")).default;
  const base = await readFirstExisting([
    "public/templates/template-01-base.png",
    "public/templates/template-01.png",
    "public/demo/demo-variant-01.png",
  ]);

  if (base) return base;

  return sharp({
    create: {
      width: TEMPLATE_01_LAYOUT.canvas.width,
      height: TEMPLATE_01_LAYOUT.canvas.height,
      channels: 4,
      background: "#FFFFFF",
    },
  }).png().toBuffer();
}

function dataUrlToBuffer(dataUrl = "") {
  const prefix = "base64,";
  const index = dataUrl.indexOf(prefix);
  if (!dataUrl.startsWith("data:image/") || index < 0) return null;
  return Buffer.from(dataUrl.slice(index + prefix.length), "base64");
}

async function fileFromAssetUrl(url = "") {
  if (!url) return null;
  const match = url.match(/\/api\/figma\/asset\/([^/?#]+)/);
  if (!match) return null;
  const file = decodeURIComponent(match[1]);
  const allowed = /^(generated-(subject|preview|final)-[a-zA-Z0-9.-]+\.png|person-approved(?:-transparent)?\.png|demo-final-campaign\.png|demo-variant-0[1-3]\.png)$/;
  if (!allowed.test(file)) return null;

  const candidates = [
    path.join(process.cwd(), "public", "generated", file),
    path.join(process.cwd(), "public", "demo", file),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      // try next
    }
  }

  return null;
}

async function resolveSubjectBuffer(payload: CampaignRenderPayload) {
  if (payload.subjectImageBuffer) return payload.subjectImageBuffer;
  const fromDataUrl = dataUrlToBuffer(payload.subjectImageDataUrl || "");
  if (fromDataUrl) return fromDataUrl;
  return fileFromAssetUrl(payload.subjectImageUrl || "");
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizePriceRight(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith(",") && raw.includes("€")) return raw.replace(/\s+/g, " ");
  const clean = raw.replace(/^,/, "").replace(/€/g, "").trim();
  return `,${clean} €`;
}

function estimateChars(box: { width: number; fontSize: number; letterSpacing?: number }) {
  const approxChar = Math.max(1, box.fontSize * 0.48 + (box.letterSpacing || 0));
  return Math.max(4, Math.floor(box.width / approxChar));
}

function wrapText(text: string, box: { width: number; fontSize: number; letterSpacing?: number; maxLines?: number }) {
  const clean = String(text || "").trim().replace(/\s+/g, " ");
  if (!clean) return [];
  const maxChars = estimateChars(box);
  const maxLines = box.maxLines || 2;
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function svgText(className: string, x: number, y: number, text: string, anchor?: "middle" | "start") {
  if (!String(text || "").trim()) return "";
  return `<text class="${className}" x="${x}" y="${y}"${anchor ? ` text-anchor="${anchor}"` : ""}>${escapeXml(text)}</text>`;
}

function baseline(y: number, fontSize: number) {
  return y + fontSize * 0.82;
}

function lineAdvance(fontSize: number, lineHeight: number) {
  return fontSize * lineHeight;
}

function textOverlay(payload: CampaignRenderPayload, width: number, height: number) {
  const layout = TEMPLATE_01_LAYOUT;
  const sx = width / layout.canvas.width;
  const sy = height / layout.canvas.height;
  const s = Math.min(sx, sy);

  const headline = payload.headline ?? PLACEHOLDER_COPY.headline;
  const priceLeft = payload.priceLeft ?? PLACEHOLDER_COPY.priceLeft;
  const priceRight = normalizePriceRight(payload.priceRight ?? PLACEHOLDER_COPY.priceRight);
  const pricePeriod = payload.pricePeriod ?? PLACEHOLDER_COPY.pricePeriod;
  const cta = payload.cta ?? PLACEHOLDER_COPY.cta;
  const legal = payload.legalNotes || payload.legalNotice || PLACEHOLDER_COPY.legalNotes;

  const headlineLines = wrapText(headline, layout.headline);
  const periodLines = wrapText(pricePeriod, layout.pricePeriod);
  const legalLines = wrapText(legal, layout.legal);

  const cleanupRects = layout.cleanup.map((rect) => (
    `<rect x="${rect.x * sx}" y="${rect.y * sy}" width="${rect.width * sx}" height="${rect.height * sy}" fill="${rect.color}" />`
  )).join("\n");

  const headlineSvg = headlineLines.map((line, i) => svgText(
    "headline",
    layout.headline.x * sx,
    (baseline(layout.headline.y, layout.headline.fontSize) + i * lineAdvance(layout.headline.fontSize, layout.headline.lineHeight)) * sy,
    line,
  )).join("\n");

  const periodSvg = periodLines.map((line, i) => svgText(
    "period",
    layout.pricePeriod.x * sx,
    (baseline(layout.pricePeriod.y, layout.pricePeriod.fontSize) + i * lineAdvance(layout.pricePeriod.fontSize, layout.pricePeriod.lineHeight)) * sy,
    line,
  )).join("\n");

  const legalSvg = legalLines.map((line, i) => svgText(
    "legal",
    layout.legal.x * sx,
    (baseline(layout.legal.y, layout.legal.fontSize) + i * lineAdvance(layout.legal.fontSize, layout.legal.lineHeight)) * sy,
    line,
  )).join("\n");

  const ctaX = (layout.ctaBg.x + layout.ctaBg.width / 2) * sx;
  const ctaY = (layout.ctaBg.y + layout.ctaBg.height / 2 + layout.cta.fontSize * 0.32) * sy;

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        ${fontFaceCss()}
        .headline { font-family: 'TIM Sans Render', Arial, sans-serif; font-size: ${layout.headline.fontSize * s}px; font-weight: 900; fill: ${layout.headline.color}; letter-spacing: ${layout.headline.letterSpacing * s}px; }
        .priceLeft { font-family: 'TIM Sans Render', Arial, sans-serif; font-size: ${layout.priceLeft.fontSize * s}px; font-weight: 900; fill: ${layout.priceLeft.color}; letter-spacing: ${layout.priceLeft.letterSpacing * s}px; }
        .priceRight { font-family: 'TIM Sans Render', Arial, sans-serif; font-size: ${layout.priceRight.fontSize * s}px; font-weight: 900; fill: ${layout.priceRight.color}; letter-spacing: ${layout.priceRight.letterSpacing * s}px; }
        .period { font-family: 'TIM Sans Render', Arial, sans-serif; font-size: ${layout.pricePeriod.fontSize * s}px; font-weight: 900; fill: ${layout.pricePeriod.color}; letter-spacing: ${layout.pricePeriod.letterSpacing * s}px; }
        .cta { font-family: 'TIM Sans Render', Arial, sans-serif; font-size: ${layout.cta.fontSize * s}px; font-weight: 700; fill: ${layout.cta.color}; letter-spacing: ${layout.cta.letterSpacing * s}px; }
        .legal { font-family: 'TIM Sans Render', Arial, sans-serif; font-size: ${layout.legal.fontSize * s}px; font-weight: 900; fill: ${layout.legal.color}; letter-spacing: ${layout.legal.letterSpacing * s}px; }
      </style>
      ${cleanupRects}
      ${headlineSvg}
      ${svgText("priceLeft", layout.priceLeft.x * sx, baseline(layout.priceLeft.y, layout.priceLeft.fontSize) * sy, priceLeft)}
      ${svgText("priceRight", layout.priceRight.x * sx, baseline(layout.priceRight.y, layout.priceRight.fontSize) * sy, priceRight)}
      ${periodSvg}
      <rect x="${layout.ctaBg.x * sx}" y="${layout.ctaBg.y * sy}" width="${layout.ctaBg.width * sx}" height="${layout.ctaBg.height * sy}" rx="${layout.ctaBg.radius * s}" fill="${layout.ctaBg.color}" />
      ${svgText("cta", ctaX, ctaY, cta, "middle")}
      ${legalSvg}
    </svg>
  `);
}

async function makeSubjectOverlay(subjectBuffer: Buffer, width: number, height: number) {
  const sharp = (await import("sharp")).default;
  const slot = TEMPLATE_01_LAYOUT.subject;
  const sx = width / TEMPLATE_01_LAYOUT.canvas.width;
  const sy = height / TEMPLATE_01_LAYOUT.canvas.height;

  let prepared = await sharp(subjectBuffer)
    .ensureAlpha()
    .trim({ threshold: 12 })
    .resize({
      width: Math.round(slot.width * sx),
      height: Math.round(slot.height * sy),
      fit: "contain",
      withoutEnlargement: false,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  const meta = await sharp(prepared).metadata();
  const overlayWidth = meta.width || Math.round(slot.width * sx);
  const overlayHeight = meta.height || Math.round(slot.height * sy);
  const left = Math.round(slot.x * sx);
  const top = Math.round(slot.y * sy);

  const sourceLeft = Math.max(0, -left);
  const sourceTop = Math.max(0, -top);
  const destinationLeft = Math.max(0, left);
  const destinationTop = Math.max(0, top);
  const visibleWidth = Math.max(1, Math.min(overlayWidth - sourceLeft, width - destinationLeft));
  const visibleHeight = Math.max(1, Math.min(overlayHeight - sourceTop, height - destinationTop));

  prepared = await sharp(prepared)
    .extract({ left: sourceLeft, top: sourceTop, width: visibleWidth, height: visibleHeight })
    .png()
    .toBuffer();

  return { input: prepared, left: destinationLeft, top: destinationTop };
}

export async function renderCampaignPreview(payload: CampaignRenderPayload) {
  const sharp = (await import("sharp")).default;
  const template = await readTemplate();
  const meta = await sharp(template).metadata();
  const width = meta.width || TEMPLATE_01_LAYOUT.canvas.width;
  const height = meta.height || TEMPLATE_01_LAYOUT.canvas.height;
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  const subjectBuffer = await resolveSubjectBuffer(payload);
  if (subjectBuffer) {
    composites.push(await makeSubjectOverlay(subjectBuffer, width, height));
  }

  composites.push({ input: textOverlay(payload, width, height), left: 0, top: 0 });

  const output = await sharp(template).ensureAlpha().composite(composites).png().toBuffer();
  return output;
}

export async function renderAndSaveCampaignPreview(payload: CampaignRenderPayload) {
  const filename = payload.outputFileName || `generated-final-${Date.now()}.png`;
  const output = await renderCampaignPreview(payload);
  await mkdir(generatedDir(), { recursive: true });
  await writeFile(path.join(generatedDir(), filename), output);
  return { filename, imageUrl: assetUrl(filename), buffer: output };
}
