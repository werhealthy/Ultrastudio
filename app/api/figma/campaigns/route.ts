import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

const CAMPAIGNS_KEY = "ultrastudio:campaigns";  // lista ordinata, max 10
const LATEST_KEY    = "ultrastudio:latest";

function getRedis() {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("KV non configurato.");
  return new Redis({ url, token });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  try {
    const redis = getRedis();
    // Legge lista campagne (array JSON salvato in KV)
    const raw = await redis.get(CAMPAIGNS_KEY);
    const campaigns = Array.isArray(raw) ? raw : [];

    // Se lista vuota, fallback su latest singolo
    if (!campaigns.length) {
      const latest = await redis.get(LATEST_KEY);
      if (latest) {
        return NextResponse.json([{ id: "latest", ...(latest as object) }], { headers: corsHeaders() });
      }
      return NextResponse.json([], { headers: corsHeaders() });
    }

    return NextResponse.json(campaigns, { headers: corsHeaders() });
  } catch (e) {
    console.error("[figma/campaigns]", e);
    return NextResponse.json([], { headers: corsHeaders() });
  }
}
