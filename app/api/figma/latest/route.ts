import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type LatestPayload = {
  campaignName?: string;
  personImageDataUrl?: string;
  personImageUrl?: string;
  headline?: string;
  priceLeft?: string;
  priceRight?: string;
  pricePeriod?: string;
  cta?: string;
  legalNotes?: string;
  legalNotice?: string;
  finalImageUrl?: string;
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function baseUrlFromRequest(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function generatedDir() {
  return path.join(process.cwd(), "public", "generated");
}

function latestPath() {
  return path.join(generatedDir(), "latest.json");
}

function formatPriceRight(value = "90") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const clean = raw.replace(/^,/, "").replace(/€$/, "").trim();
  return `,${clean} €`;
}

async function readLatest() {
  try {
    const raw = await readFile(latestPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeDataUrlImage(dataUrl: string, filename: string) {
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) throw new Error("Formato immagine non valido.");

  await mkdir(generatedDir(), { recursive: true });
  const buffer = Buffer.from(match[1], "base64");
  await writeFile(path.join(generatedDir(), filename), buffer);
}

function fileFromAssetUrl(value?: string) {
  if (!value) return null;
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(value, "http://localhost:3000");
    const match = url.pathname.match(/\/api\/figma\/asset\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    const match = value.match(/\/api\/figma\/asset\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request) {
  const baseUrl = baseUrlFromRequest(request);
  const latest = await readLatest();

  const data = latest || {
    campaignName: "TIM WiFi Casa",
    headline: "Qui navigo alla grande",
    priceLeft: "24",
    priceRight: ",90 €",
    pricePeriod: "mese",
    cta: "Scegli TIM WiFi CASA",
    personAssetFile: "person-approved.png",
    finalAssetFile: "demo-final-campaign.png",
  };

  const personFile = data.personAssetFile || "person-approved.png";
  const finalFile = data.finalAssetFile || data.personAssetFile || "demo-final-campaign.png";

  return NextResponse.json(
    {
      campaignName: data.campaignName || "TIM WiFi Casa",
      headline: data.headline || "Qui navigo alla grande",
      priceLeft: data.priceLeft || "24",
      priceRight: formatPriceRight(data.priceRight || ",90 €"),
      pricePeriod: data.pricePeriod || "mese",
      cta: data.cta || "Scegli TIM WiFi CASA",
      legalNotes: data.legalNotes || data.legalNotice || "",
      legalNotice: data.legalNotice || data.legalNotes || "",
      personImageUrl: `${baseUrl}/api/figma/asset/${personFile}`,
      imageUrl: `${baseUrl}/api/figma/asset/${personFile}`,
      finalImageUrl: `${baseUrl}/api/figma/asset/${finalFile}`,
      logoUrl: `${baseUrl}/api/figma/asset/logo-ultrastudio.png`,
    },
    { headers: corsHeaders() }
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LatestPayload;
    let personAssetFile = "person-approved-transparent.png";
    let finalAssetFile = personAssetFile;

    if (body.personImageDataUrl) {
      await writeDataUrlImage(body.personImageDataUrl, personAssetFile);
    } else if (body.personImageUrl) {
      const file = fileFromAssetUrl(body.personImageUrl);
      if (!file) throw new Error("URL soggetto non riconosciuto.");
      personAssetFile = file;
    } else {
      return NextResponse.json({ error: "Soggetto approvato mancante." }, { status: 400, headers: corsHeaders() });
    }

    const finalFileFromUrl = fileFromAssetUrl(body.finalImageUrl);
    if (finalFileFromUrl) finalAssetFile = finalFileFromUrl;

    const latest = {
      campaignName: body.campaignName || "TIM WiFi Casa",
      headline: body.headline || "",
      priceLeft: body.priceLeft || "",
      priceRight: formatPriceRight(body.priceRight || ""),
      pricePeriod: body.pricePeriod || "",
      cta: body.cta || "",
      legalNotes: body.legalNotes || body.legalNotice || "",
      legalNotice: body.legalNotice || body.legalNotes || "",
      personAssetFile,
      finalAssetFile,
      updatedAt: new Date().toISOString(),
    };

    await mkdir(generatedDir(), { recursive: true });
    await writeFile(latestPath(), JSON.stringify(latest, null, 2), "utf8");

    return NextResponse.json({ ok: true, latest }, { headers: corsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Salvataggio non riuscito.";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders() });
  }
}
