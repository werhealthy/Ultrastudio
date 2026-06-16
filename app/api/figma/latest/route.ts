import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

const LATEST_KEY = "ultrastudio:latest";

// Upstash usa KV_REST_API_URL e KV_REST_API_TOKEN (aggiunti automaticamente da Vercel)
function getRedis() {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("KV_REST_API_URL / KV_REST_API_TOKEN non configurate.");
  return new Redis({ url, token });
}

type LatestPayload = {
  campaignName?: string;
  personImageUrl?: string;   // URL tipo /api/figma/asset/generated-subject-xxx.png
  personImageB64?: string;   // base64 del soggetto (alternativa all'URL)
  headline?: string;
  priceLeft?: string;
  priceRight?: string;
  pricePeriod?: string;
  cta?: string;
  legalNotes?: string;
  legalNotice?: string;
  finalImageUrl?: string;
  finalImageB64?: string;
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

function formatPriceRight(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const clean = raw.replace(/^,/, "").replace(/€$/, "").trim();
  return `,${clean} €`;
}

function fileFromAssetUrl(value?: string) {
  if (!value) return null;
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(value, "http://localhost:3000");
    const m = url.pathname.match(/\/api\/figma\/asset\/([^/]+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    const m = value?.match(/\/api\/figma\/asset\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request) {
  const baseUrl = baseUrlFromRequest(request);

  let data: any = null;
  try {
    const redis = getRedis();
    data = await redis.get(LATEST_KEY);
  } catch (e) {
    console.error("[figma/latest] Redis read error:", e);
  }

  // Fallback defaults se non c'è nulla nel KV
  data = data || {
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
  const finalFile  = data.finalAssetFile  || "demo-final-campaign.png";

  return NextResponse.json({
    campaignName:   data.campaignName  || "TIM WiFi Casa",
    headline:       data.headline      || "",
    priceLeft:      data.priceLeft     || "24",
    priceRight:     formatPriceRight(data.priceRight || ",90 €"),
    pricePeriod:    data.pricePeriod   || "mese",
    cta:            data.cta           || "",
    legalNotes:     data.legalNotes    || "",
    legalNotice:    data.legalNotes    || "",
    personImageUrl: `${baseUrl}/api/figma/asset/${personFile}`,
    imageUrl:       `${baseUrl}/api/figma/asset/${personFile}`,
    finalImageUrl:  `${baseUrl}/api/figma/asset/${finalFile}`,
    logoUrl:        `${baseUrl}/api/figma/asset/logo-ultrastudio.png`,
  }, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LatestPayload;

    // Ricava il nome del file soggetto dall'URL
    let personAssetFile = "person-approved.png";
    if (body.personImageUrl) {
      const file = fileFromAssetUrl(body.personImageUrl);
      if (file) personAssetFile = file;
    }

    let finalAssetFile = personAssetFile;
    if (body.finalImageUrl) {
      const file = fileFromAssetUrl(body.finalImageUrl);
      if (file) finalAssetFile = file;
    }

    const latest = {
      campaignName:   body.campaignName || "TIM WiFi Casa",
      headline:       body.headline     || "",
      priceLeft:      body.priceLeft    || "",
      priceRight:     formatPriceRight(body.priceRight || ""),
      pricePeriod:    body.pricePeriod  || "",
      cta:            body.cta          || "",
      legalNotes:     body.legalNotes   || body.legalNotice || "",
      personAssetFile,
      finalAssetFile,
      updatedAt: new Date().toISOString(),
    };

    // Salva su Upstash KV (TTL 7 giorni)
    const redis = getRedis();
    await redis.set(LATEST_KEY, latest, { ex: 60 * 60 * 24 * 7 });

    // Aggiorna lista campagne (max 10, la più recente prima)
    const CAMPAIGNS_KEY = "ultrastudio:campaigns";
    const MAX_CAMPAIGNS = 10;
    const rawList = await redis.get(CAMPAIGNS_KEY);
    const list: any[] = Array.isArray(rawList) ? rawList : [];
    const newEntry = { id: `campaign-${Date.now()}`, ...latest };
    const updated = [newEntry, ...list].slice(0, MAX_CAMPAIGNS);
    await redis.set(CAMPAIGNS_KEY, updated, { ex: 60 * 60 * 24 * 30 }); // 30 giorni

    return NextResponse.json({ ok: true, latest }, { headers: corsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Salvataggio non riuscito.";
    console.error("[figma/latest] POST error:", error);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders() });
  }
}
