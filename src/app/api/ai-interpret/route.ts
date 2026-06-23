/**
 * /api/ai-interpret — Gemini-powered GeoHealth interpreter.
 *
 * Uses the z-ai-web-dev-sdk chat completions API (Gemini-class model)
 * to turn the raw SMOD + accessibility + nearest-facility numbers into
 * plain-language guidance for a community health planner.
 *
 * The endpoint supports two modes:
 *  1. Initial interpretation — when a new location is selected, the
 *     client calls this with no `question` and the assistant returns a
 *     short, structured interpretation of the full result.
 *  2. Follow-up chat — the client passes a `question` plus prior
 *     `history` for multi-turn conversation about the same location.
 *
 * If the SDK is unavailable (e.g., missing credentials in the sandbox),
 * a deterministic fallback explanation is returned so the dashboard
 * remains functional.
 */

import { NextRequest, NextResponse } from "next/server";
import type {
  AIInterpretRequest,
  AIInterpretResponse,
  GeoHealthResult,
} from "@/types/geohealth";

// ---------------------------------------------------------------------------
// System prompt — defines the assistant's persona and reasoning style.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are GeoHealth Insight, an assistant that explains Nigerian settlement-classification and health-accessibility results to community health planners and policy makers.

You are given a single GeoHealthResult for a coordinate in Nigeria. It contains three signals:
1. SMOD classification (GHS-SMOD R2023A degree of urbanisation): "high-density urban" (code 30), "urban" (21/22), "suburban" (23), "rural" (11/12/13), or "unknown" (10 / outside coverage).
2. Health accessibility: an accessibility_score (supply/demand ratio), facilities_per_100k, and a WHO-style status of "underserved" (<20 facilities per 100k people), "served" (20-200), or "overserved" (>200). "unknown" means the coordinate is outside coverage.
3. Nearest facility: name, straight-line distance, driving distance and travel time when routing succeeds.

Your job:
- Write in clear, plain English a non-specialist planner can act on. Avoid jargon; explain SMOD codes when relevant.
- Anchor your interpretation in the actual numbers provided (quote the SMOD code, the facilities-per-100k, the driving time, etc.).
- Highlight what the numbers mean for medicine access, malaria programme planning, and equitable service delivery, since this tool supports Nigeria's National Malaria Elimination Programme.
- Be concise: 120-180 words for an initial interpretation, shorter for follow-ups. Use short paragraphs or a few bullet points — never a wall of text.
- If the user asks a follow-up question, answer it specifically using the same result; do not invent data not in the result.
- If the result is "unknown" / outside coverage, say so plainly and suggest checking the coordinate.
- Never invent a facility name, distance, or score that is not in the result. If information is missing, say "not available" rather than guessing.

Tone: professional, calm, decision-supportive. Not alarmist. Use metric units.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function describeResult(r: GeoHealthResult): string {
  const parts: string[] = [];
  parts.push(`Coordinate: ${r.lat.toFixed(4)}° N, ${r.lon.toFixed(4)}° E`);
  if (r.address) parts.push(`Place: ${r.address}`);

  if (r.classify) {
    parts.push(
      `SMOD: ${r.classify.location_type} (code ${r.classify.smod_code ?? "n/a"}, ${r.classify.classification_reason})`,
    );
  } else {
    parts.push("SMOD: not available");
  }

  if (r.accessibility && r.accessibility.accessibility_score !== null) {
    parts.push(
      `Accessibility: score ${r.accessibility.accessibility_score.toFixed(6)}, ${r.accessibility.facilities_per_100k?.toFixed(1)} facilities per 100k, status "${r.accessibility.status}"`,
    );
  } else {
    parts.push("Accessibility: unknown / outside coverage");
  }

  if (r.nearestFacility) {
    const nf = r.nearestFacility;
    parts.push(
      `Nearest facility: ${nf.facility_name} at ${nf.straight_line_distance_km} km straight line, ${nf.driving_distance_km ?? "n/a"} km drive, ${nf.travel_time_minutes ?? "n/a"} minutes (routing: ${nf.routing_status}).`,
    );
  } else {
    parts.push("Nearest facility: not available");
  }

  return parts.join("\n");
}

/** Deterministic fallback used only if the SDK is unavailable. */
function buildFallbackReply(r: GeoHealthResult, question?: string): string {
  const smod = r.classify?.location_type ?? "unknown";
  const code = r.classify?.smod_code;
  const status = r.accessibility?.status ?? "unknown";
  const fpc = r.accessibility?.facilities_per_100k;
  const nf = r.nearestFacility;

  const lines: string[] = [];

  if (question) {
    lines.push(
      `Regarding your question — based on the ${smod} classification (SMOD ${code ?? "n/a"}) and "${status}" accessibility status at this location:`,
    );
  } else {
    lines.push(
      `This location is classified as **${smod}** (SMOD code ${code ?? "n/a"}).`,
    );
  }

  if (status === "underserved") {
    lines.push(
      `Accessibility is **underserved** — roughly ${fpc?.toFixed(1) ?? "n/a"} health facilities per 100,000 people, well below the WHO 20-per-100k floor.`,
    );
    lines.push(
      `For malaria programme planning, this signals a community where medicine access points are scarce and referral times are likely long.`,
    );
  } else if (status === "served") {
    lines.push(
      `Accessibility is within the served band (${fpc?.toFixed(1) ?? "n/a"} facilities per 100,000 people).`,
    );
    lines.push(
      `The location is reasonably provisioned for routine primary care, though sub-national tailoring may still be needed for hard-to-reach sub-groups.`,
    );
  } else if (status === "overserved") {
    lines.push(
      `Accessibility is overserved (${fpc?.toFixed(1) ?? "n/a"} facilities per 100,000 people).`,
    );
    lines.push(
      `This suggests an urban concentration of facilities; consider whether supply is matched by demand or whether surrounding peri-urban areas are being under-served.`,
    );
  } else {
    lines.push(
      `Accessibility could not be computed — the coordinate may be outside Nigeria coverage.`,
    );
  }

  if (nf) {
    lines.push(
      `Closest mapped facility: ${nf.facility_name}, ~${nf.driving_distance_km ?? nf.straight_line_distance_km} km away (${nf.travel_time_minutes ?? "?"} min drive).`,
    );
  }

  return lines.join(" ");
}

// ---------------------------------------------------------------------------
// LLM providers — supports three modes (in priority order):
//   1. Google Gemini (your own key from https://aistudio.google.com/apikey)
//      activated by setting GEMINI_API_KEY. Optional GEMINI_MODEL picks the
//      model (defaults to "gemini-1.5-flash").
//   2. Z.ai hosted Gemini-class SDK — works out of the box in the sandbox.
//   3. Deterministic fallback template — always available as a last resort.
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

async function callGoogleGemini(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string | null> {
  // Dynamic import keeps the SDK out of any client bundle.
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
  });

  // Google's SDK expects a flat contents[] array. The first user turn
  // carries the system context (already injected via systemInstruction),
  // and we pass history + the latest user message.
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const result = await model.generateContent({ contents });
  return result?.response?.text()?.trim() || null;
}

async function callZAIHosted(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<string | null> {
  const ZAIModule = await import("z-ai-web-dev-sdk");
  const ZAI = (ZAIModule as { default?: any }).default ?? ZAIModule;
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
  });
  return completion?.choices?.[0]?.message?.content?.trim() || null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let payload: AIInterpretRequest;
  try {
    payload = (await request.json()) as AIInterpretRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { result, question, history } = payload;
  if (!result || typeof result.lat !== "number") {
    return NextResponse.json(
      { error: "result is required" },
      { status: 400 },
    );
  }

  // Build the message list for the LLM.
  const resultDescription = describeResult(result);
  const initialInstruction =
    "Here is the GeoHealth result for the selected coordinate. Interpret it for a community health planner in 120-180 words, plain English, anchored in the numbers.";

  type Msg = { role: "system" | "user" | "assistant"; content: string };
  const messages: Msg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `${initialInstruction}\n\n--- GEOHEALTH RESULT ---\n${resultDescription}`,
    },
  ];

  // Append prior history (only user/assistant turns).
  if (history && Array.isArray(history)) {
    for (const m of history) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }

  // Append the new question if provided.
  if (question && question.trim().length > 0) {
    messages.push({ role: "user", content: question.trim() });
  }

  // The conversation turns sent to Gemini (everything except the system prompt).
  const conversationTurns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // --- Mode 1: Your own Google Gemini API key ---------------------------
  if (GEMINI_API_KEY) {
    try {
      const reply = await callGoogleGemini(SYSTEM_PROMPT, conversationTurns);
      if (reply) {
        return NextResponse.json({
          reply,
        } satisfies AIInterpretResponse);
      }
    } catch (err) {
      console.error(
        "[ai-interpret] Google Gemini call failed:",
        (err as Error).message,
      );
      // Fall through to Z.ai hosted.
    }
  }

  // --- Mode 2: Z.ai hosted Gemini-class SDK -----------------------------
  try {
    const reply = await callZAIHosted(messages);
    if (reply) {
      return NextResponse.json({ reply } satisfies AIInterpretResponse);
    }
  } catch (err) {
    console.error(
      "[ai-interpret] Z.ai SDK call failed:",
      (err as Error).message,
    );
  }

  // --- Mode 3: Deterministic fallback template --------------------------
  return NextResponse.json({
    reply: buildFallbackReply(result, question),
    fallback: true,
  } satisfies AIInterpretResponse);
}

export async function GET() {
  return NextResponse.json({
    service: "geohealth-ai-interpret",
    provider: GEMINI_API_KEY
      ? `google-gemini (${GEMINI_MODEL})`
      : "zai-hosted-gemini-class",
    fallback: "deterministic-template",
    env: {
      GEMINI_API_KEY: GEMINI_API_KEY ? "set ✓" : "not set",
      GEMINI_MODEL: GEMINI_MODEL,
    },
  });
}
