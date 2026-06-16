import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";
import { TEMPLATE_01_LAYOUT } from "@/lib/template-layout";

export const runtime = "nodejs";
export const maxDuration = 60;

type ComposePayload = {
  subjectImageDataUrl?: string;
  subjectImageUrl?: string;      // URL pubblico (Blob o locale)
  headline?: string;
  priceLeft?: string;
  priceRight?: string;
  pricePeriod?: string;
  cta?: string;
  legalNotes?: string;
  legalNotice?: string;
  outputName?: string;
};

type CompositeInput = { input: Buffer; left: number; top: number };

const COL_X = 526;
const COL_W = 644;
const PAD_TOP = 11;
const BLUE  = "#0033A1";
const RED   = "#EB0028";
const WHITE = "#FFFFFF";

const HL  = { size: 95.151, lh: 1.0,  ls: -5.709, maxLines: 2 };
const DA  = { size: 52,     lh: 1.2 };
const PL  = { size: 148.132, ls: -8.888 };
const PR  = { size: 60.769,  ls: -3.646 };
const PP  = { size: 19.068, lh: 1.4, ls: -1.144, maxLines: 3 };
const CTA = { size: 28.611, lh: 1.0, ls: -0.572, boxW: 342.37, boxH: 90.37, radius: 14 };
const LG  = { size: 22,     lh: 1.3, ls: -0.25,  maxLines: 3 };

const GAP_HL_DA  = 28;
const GAP_DA_PL  = 8;
const GAP_PL_CTA = 14;
const GAP_CTA_LG = 16;
const PR_DY = 19;
const PP_DY = 68;

function esc(v = "") {
  return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

function normPriceRight(v = "") {
  const r = String(v||"").trim();
  if (!r) return "";
  if (r.startsWith(",") && r.includes("€")) return r;
  return `,${r.replace(/^,/,"").replace(/€/g,"").trim()} €`;
}

function wrap(text: string, maxW: number, fontSize: number, ls: number, maxLines: number): string[] {
  const clean = String(text||"").trim().replace(/\s+/g," ");
  if (!clean) return [];
  const cw = Math.max(1, fontSize * 0.52 + ls);
  const max = Math.max(3, Math.floor(maxW / cw));
  const words = clean.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

function dataUrlToBuffer(du = "") {
  const i = du.indexOf("base64,");
  if (!du.startsWith("data:image/") || i < 0) return null;
  return Buffer.from(du.slice(i+7), "base64");
}

async function readSubject(body: ComposePayload): Promise<Buffer | null> {
  // 1. base64 diretto
  if (body.subjectImageDataUrl) {
    const buf = dataUrlToBuffer(body.subjectImageDataUrl);
    if (buf) return buf;
  }
  // 2. URL pubblico (Blob o localhost)
  if (body.subjectImageUrl) {
    try {
      const url = body.subjectImageUrl.startsWith("http")
        ? body.subjectImageUrl
        : `http://localhost:3000${body.subjectImageUrl}`;
      const r = await fetch(url);
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      console.error("[compose-campaign] readSubject fetch error:", e);
    }
  }
  return null;
}

async function readTplFile(rel: string) {
  try { return await readFile(path.join(process.cwd(), rel)); } catch { return null; }
}

/**
 * Configura fontconfig per trovare i font TIM Sans su Vercel/serverless.
 * Sharp usa librsvg che si appoggia a fontconfig.
 * Su Vercel i font non sono installati nel sistema — bisogna dire
 * esplicitamente a fontconfig dove trovarli tramite fonts.conf.
 */
async function setupFontConfig() {
  const { writeFile, mkdir } = await import("fs/promises");
  const fontDir = path.join(process.cwd(), "public", "fonts");
  const fontsCacheDir = "/tmp/fonts-cache";
  const fontsConfPath = path.join("/tmp", "fonts.conf");

  await mkdir(fontsCacheDir, { recursive: true });

  const fontsConf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>${fontsCacheDir}</cachedir>
  <config></config>
</fontconfig>`;

  await writeFile(fontsConfPath, fontsConf, "utf8");
  process.env.FONTCONFIG_FILE = fontsConfPath;
}

async function fontCss() {
  const f = TEMPLATE_01_LAYOUT.files.fonts;
  const face = (w: number, file: string) =>
    `@font-face{font-family:'T';src:local('TIM Sans');font-weight:${w};font-style:normal;}`;
  // Su Vercel usiamo font-family con nome registrato via fontconfig
  // Su locale usiamo i data URL embedded
  if (process.env.VERCEL) {
    // Font sono in public/fonts/ — fontconfig li trova tramite fonts.conf
    return [
      `@font-face{font-family:'T';src:local('TIMSans-Heavy');font-weight:900;font-style:normal;}`,
      `@font-face{font-family:'T';src:local('TIMSans-Bold');font-weight:700;font-style:normal;}`,
      `@font-face{font-family:'T';src:local('TIMSans-Medium');font-weight:500;font-style:normal;}`,
      `@font-face{font-family:'T';src:local('TIMSans-Regular');font-weight:400;font-style:normal;}`,
    ].join("");
  }
  // Locale: embed come base64
  const readFontB64 = async (rel: string) => {
    try {
      const b = await readFile(path.join(process.cwd(), rel));
      return `data:font/truetype;base64,${b.toString("base64")}`;
    } catch { return ""; }
  };
  const [hv,bd,md,rg] = await Promise.all([
    readFontB64(f.heavy), readFontB64(f.bold), readFontB64(f.medium), readFontB64(f.regular),
  ]);
  const faceB64 = (src: string, w: number) => src
    ? `@font-face{font-family:'T';src:url('${src}')format('truetype');font-weight:${w};font-style:normal;}` : "";
  return faceB64(hv,900)+faceB64(bd,700)+faceB64(md,500)+faceB64(rg,400);
}

async function readTemplate() {
  const sharp = (await import("sharp")).default;
  const { canvas, files } = TEMPLATE_01_LAYOUT;
  const tpl = (
    await readTplFile(path.join("public","templates",files.template)) ||
    await readTplFile(path.join("public","templates",files.fallbackTemplate))
  );
  if (tpl) {
    console.log(`[compose-campaign] template loaded: ${files.template}, size: ${tpl.length}`);
    return tpl;
  }
  console.warn("[compose-campaign] template NOT found, using white canvas");
  return await sharp({ create:{ width:canvas.width, height:canvas.height, channels:4, background:"#FFFFFF" }}).png().toBuffer();
}

async function buildOverlay(payload: ComposePayload, W: number, H: number): Promise<Buffer> {
  const fonts = await fontCss();
  const pLeft   = String(payload.priceLeft  || "").trim();
  const pRight  = normPriceRight(payload.priceRight || "");
  const ctaTxt  = String(payload.cta || "").trim();
  const legalTxt = String(payload.legalNotes || payload.legalNotice || "").trim();
  const hlTxt   = String(payload.headline || "").trim();

  const hlLines  = wrap(hlTxt, COL_W, HL.size, HL.ls, HL.maxLines);
  const hlLineH  = HL.size * HL.lh;
  const hlBlockH = hlLines.length * hlLineH;

  let y = PAD_TOP;
  const hlY0 = y + HL.size * 0.82;
  y += hlBlockH;
  y += GAP_HL_DA;

  const hasPriceBlock = Boolean(pLeft);
  const daY = y + DA.size * 0.82;
  if (hasPriceBlock) y += DA.size * DA.lh;
  if (hasPriceBlock) y += GAP_DA_PL;

  const plTopY  = y;
  const plBaseY = y + PL.size * 0.82;
  const prTopY  = plTopY + PR_DY;
  const prBaseY = prTopY + PR.size * 0.82;
  const ppTopY  = prTopY + PP_DY;
  const ppBaseY = ppTopY + PP.size * 0.82;
  const ppLines = wrap(String(payload.pricePeriod||""), 200, PP.size, PP.ls, PP.maxLines);

  const plBottomY = plTopY + PL.size;
  const ppBottomY = ppTopY + PP.size * PP.lh * ppLines.length;
  if (hasPriceBlock) y = Math.max(plBottomY, ppBottomY);
  y += GAP_PL_CTA;

  const ctaBoxY = y;
  const ctaTxtX = COL_X + CTA.boxW / 2;
  const ctaTxtY = ctaBoxY + CTA.boxH / 2 + CTA.size * 0.35;
  y += CTA.boxH + GAP_CTA_LG;

  const lgY0    = y + LG.size * 0.82;
  const lgLineH = LG.size * LG.lh;
  const lgLines = wrap(legalTxt, COL_W, LG.size, LG.ls, LG.maxLines);

  const hlSvg = hlLines.map((ln,i) =>
    `<text class="hl" x="${COL_X}" y="${hlY0+i*hlLineH}">${esc(ln)}</text>`
  ).join("\n");

  const daSvg = hasPriceBlock ? `<text class="da" x="${COL_X}" y="${daY}">da</text>` : "";
  const plSvg = hasPriceBlock && pLeft
    ? `<text class="pl" x="${COL_X}" y="${plBaseY}">${esc(pLeft)}</text>` : "";

  const isPlaceholder = /[xX]/.test(pLeft);
  const plEstW = isPlaceholder ? 193 : Math.min(pLeft.length * (PL.size * 0.48 + Math.abs(PL.ls)), 233);
  const prX = COL_X + plEstW + 6;

  const prSvg = hasPriceBlock && pRight
    ? `<text class="pr" x="${prX}" y="${prBaseY}">${esc(pRight)}</text>` : "";
  const ppSvg = hasPriceBlock && ppLines.length
    ? ppLines.map((ln,i) => `<text class="pp" x="${prX}" y="${ppBaseY+i*PP.size*PP.lh}">${esc(ln)}</text>`).join("\n") : "";

  const ctaSvg = ctaTxt ? `
    <rect x="${COL_X}" y="${ctaBoxY}" width="${CTA.boxW}" height="${CTA.boxH}" rx="${CTA.radius}" fill="${RED}"/>
    <text class="cta" x="${ctaTxtX}" y="${ctaTxtY}" text-anchor="middle">${esc(ctaTxt)}</text>` : "";

  const lgSvg = lgLines.map((ln,i) =>
    `<text class="lg" x="${COL_X}" y="${lgY0+i*lgLineH}">${esc(ln)}</text>`
  ).join("\n");

  // SVG con dimensioni esatte del canvas — nessun viewBox
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<style>
${fonts}
.hl{font-family:'T','TIM Sans',Arial,sans-serif;font-weight:900;font-size:${HL.size}px;fill:${BLUE};letter-spacing:${HL.ls}px;}
.da{font-family:'T','TIM Sans',Arial,sans-serif;font-weight:900;font-size:${DA.size}px;fill:${BLUE};letter-spacing:-1px;}
.pl{font-family:'T','TIM Sans',Arial,sans-serif;font-weight:900;font-size:${PL.size}px;fill:${BLUE};letter-spacing:${PL.ls}px;}
.pr{font-family:'T','TIM Sans',Arial,sans-serif;font-weight:900;font-size:${PR.size}px;fill:${BLUE};letter-spacing:${PR.ls}px;}
.pp{font-family:'T','TIM Sans',Arial,sans-serif;font-weight:900;font-size:${PP.size}px;fill:${BLUE};letter-spacing:${PP.ls}px;}
.cta{font-family:'T','TIM Sans',Arial,sans-serif;font-weight:700;font-size:${CTA.size}px;fill:${WHITE};letter-spacing:${CTA.ls}px;}
.lg{font-family:'T','TIM Sans',Arial,sans-serif;font-weight:500;font-size:${LG.size}px;fill:${BLUE};letter-spacing:${LG.ls}px;}
</style>
${hlSvg}${daSvg}${plSvg}${prSvg}${ppSvg}${ctaSvg}${lgSvg}
</svg>`);
}

async function buildSubjectComposite(buf: Buffer, W: number, H: number): Promise<CompositeInput> {
  const sharp = (await import("sharp")).default;
  const slot = TEMPLATE_01_LAYOUT.subject;
  const sx = W/1200, sy = H/628;
  const slotW = Math.round(slot.width*sx), slotH = Math.round(slot.height*sy);
  const slotX = Math.round(slot.x*sx),    slotY = Math.round(slot.y*sy);

  const trimmed = await sharp(buf).ensureAlpha()
    .trim({ background:{r:255,g:255,b:255,alpha:0}, threshold:10 }).toBuffer();
  const resized = await sharp(trimmed)
    .resize({ width:slotW, height:slotH, fit:"inside", withoutEnlargement:false, background:{r:0,g:0,b:0,alpha:0} })
    .png({ compressionLevel:9 }).toBuffer();

  const m = await sharp(resized).metadata();
  const rW = m.width??slotW, rH = m.height??slotH;
  const destLeft = slotX + Math.round((slotW-rW)/2);
  const destTop  = slotY + slotH - rH;
  const srcLeft  = Math.max(0,-destLeft), srcTop = Math.max(0,-destTop);
  const finalLeft = Math.max(0,destLeft), finalTop = Math.max(0,destTop);
  const visW = Math.max(1,Math.min(rW-srcLeft,W-finalLeft));
  const visH = Math.max(1,Math.min(rH-srcTop, H-finalTop));

  const cropped = await sharp(resized)
    .extract({ left:srcLeft, top:srcTop, width:visW, height:visH })
    .png({ compressionLevel:9 }).toBuffer();
  return { input:cropped, left:finalLeft, top:finalTop };
}

export async function POST(request: Request) {
  try {
    const sharp = (await import("sharp")).default;
    const body  = (await request.json()) as ComposePayload;
    const tmpl  = await readTemplate();
    const meta  = await sharp(tmpl).metadata();
    const W = meta.width||1200, H = meta.height||628;

    const composites: CompositeInput[] = [];

    // Setup fontconfig per Vercel — deve girare PRIMA di Sharp
    if (process.env.VERCEL) await setupFontConfig();
    const subBuf = await readSubject(body);
    if (subBuf) composites.push(await buildSubjectComposite(subBuf, W, H));
    composites.push({ input: await buildOverlay(body, W, H), left:0, top:0 });

    const out = await sharp(tmpl).ensureAlpha().composite(composites).png().toBuffer();

    // Carica su Vercel Blob
    const filename = String(body.outputName || `composed-${Date.now()}.png`).replace(/[^a-zA-Z0-9._-]/g,"");
    const fname = filename.endsWith(".png") ? filename : `${filename}.png`;

    const blob = await put(fname, out, {
      access: "public",
      contentType: "image/png",
    });

    console.log(`[compose-campaign] uploaded: ${blob.url}`);
    return NextResponse.json({ imageUrl: blob.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Composizione non riuscita.";
    console.error("[compose-campaign]", err);
    return NextResponse.json({ error:msg }, { status:500 });
  }
}
