import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { GEMINI_SUSTAINABILITY_SYSTEM_PROMPT } from "@/lib/gemini/system-prompt";
import { buildCompanyPayload, type ScoreRowWithDistance } from "@/lib/gemini/build-company-payload";
import { GeminiAnalysisSchema, type GeminiAnalysis } from "@/lib/gemini/schema";
import {
  callGemini,
  GeminiApiError,
  GeminiMissingApiKeyError,
  GeminiRateLimitError,
  GeminiTimeoutError,
} from "@/lib/gemini/client";

const RequestSchema = z.object({ ticker: z.string().trim().min(1).max(10) });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedRequest = RequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: "Request must include a non-empty ticker string" }, { status: 400 });
  }
  const ticker = parsedRequest.data.ticker.toUpperCase();

  const supabase = await createClient();

  // Authoritative data always comes from our own database, never from
  // the client -- a caller can only name which company they want, not
  // supply its score/rank/variables themselves.
  const [{ data: row, error: rowError }, { count: totalCompanies, error: countError }] = await Promise.all([
    supabase.from("sp500_esg_scores").select("*").eq("ticker", ticker).maybeSingle(),
    supabase.from("sp500_esg_scores").select("*", { count: "exact", head: true }),
  ]);

  if (rowError) console.error(rowError);
  if (countError) console.error(countError);
  if (!row) {
    return NextResponse.json({ error: `No sustainability data for ticker ${ticker}` }, { status: 404 });
  }
  if (!totalCompanies) {
    return NextResponse.json({ error: "Could not determine index size" }, { status: 500 });
  }

  const scoreRow = row as ScoreRowWithDistance;

  const { data: cached, error: cacheReadError } = await supabase
    .from("sp500_esg_gemini_analysis")
    .select("*")
    .eq("ticker", ticker)
    .maybeSingle();
  if (cacheReadError) console.error(cacheReadError);

  if (cached && cached.score === scoreRow.score && cached.rank === scoreRow.rank) {
    return NextResponse.json(cached.analysis as GeminiAnalysis);
  }

  const payload = buildCompanyPayload(scoreRow, totalCompanies);

  let rawText: string;
  try {
    rawText = await callGemini(GEMINI_SUSTAINABILITY_SYSTEM_PROMPT, payload);
  } catch (err) {
    if (err instanceof GeminiMissingApiKeyError) {
      return NextResponse.json({ error: "AI analysis is not configured" }, { status: 503 });
    }
    if (err instanceof GeminiTimeoutError) {
      return NextResponse.json({ error: "AI analysis timed out, try again" }, { status: 504 });
    }
    if (err instanceof GeminiRateLimitError) {
      return NextResponse.json({ error: "AI analysis is rate-limited, try again shortly" }, { status: 429 });
    }
    if (err instanceof GeminiApiError) {
      console.error(err);
      return NextResponse.json({ error: "AI analysis service error" }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "AI analysis failed unexpectedly" }, { status: 500 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    console.error("Gemini returned non-JSON text:", rawText.slice(0, 500));
    return NextResponse.json({ error: "AI analysis returned an invalid response" }, { status: 502 });
  }

  const parsedAnalysis = GeminiAnalysisSchema.safeParse(parsedJson);
  if (!parsedAnalysis.success) {
    console.error("Gemini response failed schema validation:", parsedAnalysis.error.issues);
    return NextResponse.json({ error: "AI analysis returned an invalid response" }, { status: 502 });
  }

  // rank/total_companies are supposed to be an unmodified echo of the
  // input -- force them to our authoritative values rather than trust
  // Gemini's copy, since we already know the ground truth.
  const analysis: GeminiAnalysis = {
    ...parsedAnalysis.data,
    leaderboard_position: {
      ...parsedAnalysis.data.leaderboard_position,
      rank: scoreRow.rank,
      total_companies: totalCompanies,
    },
  };

  const { error: cacheWriteError } = await supabase.from("sp500_esg_gemini_analysis").upsert({
    ticker,
    score: scoreRow.score,
    rank: scoreRow.rank,
    analysis,
    generated_at: new Date().toISOString(),
  });
  if (cacheWriteError) console.error(cacheWriteError);

  return NextResponse.json(analysis);
}
