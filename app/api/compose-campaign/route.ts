import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { TEMPLATE_01_LAYOUT } from "@/lib/template-layout";

export const runtime = "nodejs";
export const maxDuration = 60;

type ComposePayload = {
  subjectImageDataUrl?: string;
  subjectImageUrl?: string;
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

// ── Costanti layout (misurate dal Figma, canvas 1200×628) ──────────────────
const COL_X       = 526;    // inizio colonna testo (px)
const COL_W       = 644;    // larghezza colonna testo (px)
const PAD_TOP     = 11;     // padding top colonna
const BLUE        = "#0033A1";
const RED         = "#EB0028";
const WHITE       = "#FFFFFF";

// Tipografia
const HL  = { size: 95.151, lh: 1.0,  ls: -5.709, maxLines: 2 };
const DA  = { size: 52,     lh: 1.2                             };
const PL  = { size: 148.132,           ls: -8.888               }; // numero grande
const PR  = { size: 60.769,            ls: -3.646               }; // decimali
const PP  = { size: 19.068, lh: 1.4,   ls: -1.144, maxLines: 3 }; // periodo
const CTA = { size: 28.611, lh: 1.0,   ls: -0.572,
              boxW: 342.37, boxH: 90.37, radius: 14             };
const LG  = { size: 22,     lh: 1.3,  ls: -0.25,  maxLines: 3 };

// Gap verticali tra blocchi
const GAP_HL_DA    = 28;   // headline → "da"
const GAP_DA_PL    = 8;    // "da" → numero grande
const GAP_PL_CTA   = 14;   // blocco prezzo → CTA
const GAP_CTA_LG   = 16;   // CTA → legal

// Offset interni al blocco prezzo
// priceRight top = priceLeft top + 19px (dal Figma)
const PR_DY = 19;
// pricePeriod top = priceRight top + 68px (più distanziato dal ,90€)
const PP_DY = 68;

function generatedDir() {
  return process.env.VERCEL ? "/tmp/generated" : path.join(process.cwd(), "public", "generated");
}

function esc(v = "") {
  return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

function normPriceRight(v = "") {
  const r = String(v || "").trim();
  if (!r) return "";
  if (r.startsWith(",") && r.includes("€")) return r;
  return `,${r.replace(/^,/,"").replace(/€/g,"").trim()} €`;
}

/**
 * Wrap testo in righe.
 * Usa charWidth stimata = fontSize * 0.52 + |letterSpacing|
 * (calibrata su TIM Sans Heavy condensed)
 */
function wrap(text: string, maxW: number, fontSize: number, ls: number, maxLines: number): string[] {
  const clean = String(text || "").trim().replace(/\s+/g," ");
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
  return Buffer.from(du.slice(i + 7), "base64");
}

function fileFromAssetUrl(v?: string) {
  if (!v) return null;
  try {
    const url = v.startsWith("http") ? new URL(v) : new URL(v, "http://localhost:3000");
    const m = url.pathname.match(/\/api\/figma\/asset\/([^/]+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    const m = v.match(/\/api\/figma\/asset\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

async function readSubject(body: ComposePayload) {
  const b = dataUrlToBuffer(body.subjectImageDataUrl || "");
  if (b) return b;
  const f = fileFromAssetUrl(body.subjectImageUrl);
  if (!f) return null;
  try { return await readFile(path.join(generatedDir(), f)); } catch { return null; }
}

async function readTplFile(rel: string) {
  try { return await readFile(path.join(process.cwd(), rel)); } catch { return null; }
}

async function fontDataUrl(rel: string) {
  try {
    const b = await readFile(path.join(process.cwd(), rel));
    return `data:font/truetype;base64,${b.toString("base64")}`;
  } catch { return ""; }
}

async function fontCss() {
  const f = TEMPLATE_01_LAYOUT.files.fonts;
  const [hv, bd, md, rg] = await Promise.all([
    fontDataUrl(f.heavy), fontDataUrl(f.bold),
    fontDataUrl(f.medium), fontDataUrl(f.regular),
  ]);
  const face = (src: string, w: number) => src
    ? `@font-face{font-family:'T';src:url('${src}')format('truetype');font-weight:${w};font-style:normal;}` : "";
  return face(hv,900)+face(bd,700)+face(md,500)+face(rg,400);
}

async function readTemplate() {
  const sharp = (await import("sharp")).default;
  const { canvas, files } = TEMPLATE_01_LAYOUT;
  return (
    await readTplFile(path.join("public","templates",files.template)) ||
    await readTplFile(path.join("public","templates",files.fallbackTemplate)) ||
    await sharp({ create:{ width:canvas.width, height:canvas.height, channels:4, background:"#FFFFFF" }}).png().toBuffer()
  );
}

/**
 * Costruisce il layer SVG con layout a FLUSSO VERTICALE.
 *
 * Tutti gli elementi della colonna destra si impilano dall'alto verso il basso,
 * come in un auto-layout Figma. Nessuna coordinata Y assoluta hardcoded:
 * ogni blocco parte esattamente dove finisce il precedente + il gap.
 *
 * Il blocco prezzo usa tspan per gestire il posizionamento relativo
 * di numero-grande / decimali / periodo senza stimare larghezze.
 */
async function buildOverlay(payload: ComposePayload, W: number, H: number): Promise<Buffer> {
  const sx = W / 1200;
  const sy = H / 628;
  const s  = Math.min(sx, sy);

  const fonts = await fontCss();

  const pLeft   = String(payload.priceLeft  || "").trim();
  const pRight  = normPriceRight(payload.priceRight || "");
  const ctaTxt  = String(payload.cta || "").trim();
  const legalTxt = String(payload.legalNotes || payload.legalNotice || "").trim();
  const hlTxt   = String(payload.headline || "").trim();

  // ── Calcolo flusso verticale ──────────────────────────────────────────────
  // Tutte le y sono in coordinate canvas originale (1200×628),
  // poi scalate via sx/sy all'output finale.

  const hlLines = wrap(hlTxt, COL_W, HL.size, HL.ls, HL.maxLines);
  const hlLineH = HL.size * HL.lh;
  const hlBlockH = hlLines.length * hlLineH;

  // y corrente (top del blocco corrente, coordinate originali)
  let y = PAD_TOP;

  // Headline: baseline prima riga = y + HL.size * 0.82
  const hlY0 = y + HL.size * 0.82;
  y += hlBlockH;

  // Gap headline → "da"
  y += GAP_HL_DA;

  // "da": una riga, baseline = y + DA.size * 0.82
  const hasPriceBlock = Boolean(pLeft);
  const daY = y + DA.size * 0.82;
  if (hasPriceBlock) y += DA.size * DA.lh;

  // Gap "da" → numero grande
  if (hasPriceBlock) y += GAP_DA_PL;

  // Blocco prezzo: top del numero grande
  const plTopY  = y;
  const plBaseY = y + PL.size * 0.82;   // baseline numero grande

  // Decimali: top = plTopY + PR_DY (offset Figma)
  const prTopY  = plTopY + PR_DY;
  const prBaseY = prTopY + PR.size * 0.82;

  // Periodo: top = prTopY + PP_DY
  const ppTopY  = prTopY + PP_DY;
  const ppBaseY = ppTopY + PP.size * 0.82;
  const ppLines = wrap(String(payload.pricePeriod || ""), 200, PP.size, PP.ls, PP.maxLines);

  // Bottom del blocco prezzo = max tra fine numero grande e fine periodo
  const plBottomY = plTopY + PL.size;
  const ppBottomY = ppTopY + PP.size * PP.lh * ppLines.length;
  const priceBottomY = Math.max(plBottomY, ppBottomY);

  if (hasPriceBlock) y = priceBottomY;

  // Gap prezzo → CTA
  y += GAP_PL_CTA;

  // CTA box
  const ctaBoxY   = y;
  const ctaBoxX   = COL_X;
  const ctaTxtX   = ctaBoxX + CTA.boxW / 2;   // centro orizzontale
  const ctaTxtY   = ctaBoxY + CTA.boxH / 2 + CTA.size * 0.35;
  y += CTA.boxH;

  // Gap CTA → legal
  y += GAP_CTA_LG;

  // Legal
  const lgY0   = y + LG.size * 0.82;
  const lgLineH = LG.size * LG.lh;
  const lgLines = wrap(legalTxt, COL_W, LG.size, LG.ls, LG.maxLines);

  // ── SVG ──────────────────────────────────────────────────────────────────
  // viewBox = canvas originale (1200×628), width/height = dimensioni output
  // In questo modo le coordinate sono sempre in pixel Figma e SVG scala tutto.

  const hlSvg = hlLines.map((ln, i) =>
    `<text class="hl" x="${COL_X}" y="${hlY0 + i * hlLineH}">${esc(ln)}</text>`
  ).join("\n");

  const daSvg = hasPriceBlock
    ? `<text class="da" x="${COL_X}" y="${daY}">da</text>`
    : "";

  // Numero grande
  const plSvg = hasPriceBlock && pLeft
    ? `<text class="pl" x="${COL_X}" y="${plBaseY}">${esc(pLeft)}</text>`
    : "";
  // Posizionamento priceRight:
  // - Placeholder (contiene X) → x fissa = COL_X + 193px (box Figma)
  // - Numeri reali → stimato per cifre (coefficiente 0.48)
  const isPlaceholder = /[xX]/.test(pLeft);
  const PL_BOX_FIXED = 193;
  const plCharW = PL.size * 0.48 + Math.abs(PL.ls);
  const plEstW  = isPlaceholder ? PL_BOX_FIXED : pLeft.length * plCharW;
  const prX     = COL_X + plEstW + 6;

  const prSvg = hasPriceBlock && pRight
    ? `<text class="pr" x="${prX}" y="${prBaseY}">${esc(pRight)}</text>`
    : "";

  const ppSvg = hasPriceBlock && ppLines.length
    ? ppLines.map((ln, i) =>
        `<text class="pp" x="${prX}" y="${ppBaseY + i * PP.size * PP.lh}">${esc(ln)}</text>`
      ).join("\n")
    : "";

  const ctaSvg = ctaTxt ? `
    <rect x="${ctaBoxX}" y="${ctaBoxY}" width="${CTA.boxW}" height="${CTA.boxH}"
          rx="${CTA.radius}" fill="${RED}"/>
    <text class="cta" x="${ctaTxtX}" y="${ctaTxtY}" text-anchor="middle">${esc(ctaTxt)}</text>
  ` : "";

  const lgSvg = lgLines.map((ln, i) =>
    `<text class="lg" x="${COL_X}" y="${lgY0 + i * lgLineH}">${esc(ln)}</text>`
  ).join("\n");

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg"
     width="${W}" height="${H}"
     viewBox="0 0 1200 628">
<style>
${fonts}
.hl { font-family:'T','TIM Sans',Arial,sans-serif; font-weight:900;
      font-size:${HL.size}px; fill:${BLUE}; letter-spacing:${HL.ls}px; }
.da { font-family:'T','TIM Sans',Arial,sans-serif; font-weight:900;
      font-size:${DA.size}px; fill:${BLUE}; letter-spacing:-1px; }
.pl { font-family:'T','TIM Sans',Arial,sans-serif; font-weight:900;
      font-size:${PL.size}px; fill:${BLUE}; letter-spacing:${PL.ls}px; }
.pr { font-family:'T','TIM Sans',Arial,sans-serif; font-weight:900;
      font-size:${PR.size}px; fill:${BLUE}; letter-spacing:${PR.ls}px; }
.pp { font-family:'T','TIM Sans',Arial,sans-serif; font-weight:900;
      font-size:${PP.size}px; fill:${BLUE}; letter-spacing:${PP.ls}px; }
.cta{ font-family:'T','TIM Sans',Arial,sans-serif; font-weight:700;
      font-size:${CTA.size}px; fill:${WHITE}; letter-spacing:${CTA.ls}px; }
.lg { font-family:'T','TIM Sans',Arial,sans-serif; font-weight:500;
      font-size:${LG.size}px; fill:${BLUE}; letter-spacing:${LG.ls}px; }
</style>

${hlSvg}
${daSvg}
${plSvg}
${prSvg}
${ppSvg}
${ctaSvg}
${lgSvg}
</svg>`);
}

async function buildSubjectComposite(buf: Buffer, W: number, H: number): Promise<CompositeInput> {
  const sharp = (await import("sharp")).default;
  const slot  = TEMPLATE_01_LAYOUT.subject;
  const sx = W / 1200;
  const sy = H / 628;

  const slotW = Math.round(slot.width  * sx);
  const slotH = Math.round(slot.height * sy);
  const slotX = Math.round(slot.x * sx);
  const slotY = Math.round(slot.y * sy);

  const trimmed = await sharp(buf).ensureAlpha()
    .trim({ background:{ r:255,g:255,b:255,alpha:0 }, threshold:10 })
    .toBuffer();

  const resized = await sharp(trimmed)
    .resize({ width:slotW, height:slotH, fit:"inside",
              withoutEnlargement:false, background:{ r:0,g:0,b:0,alpha:0 } })
    .png({ compressionLevel:9 }).toBuffer();

  const m   = await sharp(resized).metadata();
  const rW  = m.width  ?? slotW;
  const rH  = m.height ?? slotH;

  const destLeft  = slotX + Math.round((slotW - rW) / 2);
  const destTop   = slotY + slotH - rH;
  const srcLeft   = Math.max(0, -destLeft);
  const srcTop    = Math.max(0, -destTop);
  const finalLeft = Math.max(0, destLeft);
  const finalTop  = Math.max(0, destTop);
  const visW = Math.max(1, Math.min(rW - srcLeft, W - finalLeft));
  const visH = Math.max(1, Math.min(rH - srcTop,  H - finalTop));

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
    const W = meta.width  || 1200;
    const H = meta.height || 628;

    const composites: CompositeInput[] = [];

    const subBuf = await readSubject(body);
    if (subBuf) composites.push(await buildSubjectComposite(subBuf, W, H));

    const overlay = await buildOverlay(body, W, H);
    composites.push({ input:overlay, left:0, top:0 });

    const out = await sharp(tmpl).ensureAlpha().composite(composites).png().toBuffer();

    await mkdir(generatedDir(), { recursive:true });
    const safe  = String(body.outputName || `composed-${Date.now()}.png`).replace(/[^a-zA-Z0-9._-]/g,"");
    const fname = safe.endsWith(".png") ? safe : `${safe}.png`;
    await writeFile(path.join(generatedDir(), fname), out);

    return NextResponse.json({ imageUrl:`/api/figma/asset/${fname}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Composizione non riuscita.";
    console.error("[compose-campaign]", err);
    return NextResponse.json({ error:msg }, { status:500 });
  }
}
