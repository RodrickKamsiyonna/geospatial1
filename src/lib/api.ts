/**
 * GeoHealth API client.
 *
 * All calls go through our own Next.js proxy at /api/geohealth, which
 * in turn talks to the FastAPI backend at API_BASE_URL. This keeps the
 * upstream URL off the client and lets us transparently mock the
 * upstream when it is unreachable from the sandbox.
 */

import type {
  GeoHealthResult,
  ClassifyResponse,
  AccessibilityResponse,
  NearestFacilityResponse,
  ClassifyRequest,
  AIInterpretRequest,
  AIInterpretResponse,
  ChatMessage,
} from "@/types/geohealth";

/** Reverse-geocode a coordinate to a short human-readable label using Mapbox. */
export async function reverseGeocode(
  lat: number,
  lon: number,
  token: string,
): Promise<string> {
  if (!token) {
    return `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`;
  }
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${token}&limit=1&types=place,region,district,locality`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("geocode failed");
    const data = await res.json();
    const feat = data?.features?.[0];
    if (!feat) return `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`;
    // Combine place_name parts but keep it concise
    return feat.place_name as string;
  } catch {
    return `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`;
  }
}

async function callBackend<T>(
  endpoint: string,
  body: ClassifyRequest,
): Promise<T> {
  const res = await fetch(`/api/geohealth?endpoint=${encodeURIComponent(endpoint)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Backend /v1/${endpoint} returned ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Fetch all three GeoHealth signals (classify, accessibility, nearest
 * facility) for a single coordinate and merge them into one result.
 */
export async function fetchAllGeoHealthData(
  lat: number,
  lon: number,
  mapboxToken?: string,
): Promise<GeoHealthResult> {
  // Fire all three requests in parallel for speed.
  const [classify, accessibility, nearestFacility] = await Promise.all([
    callBackend<ClassifyResponse>("classify", { lat, lon }).catch(() => null),
    callBackend<AccessibilityResponse>("classify-accessibility", { lat, lon }).catch(
      () => null,
    ),
    callBackend<NearestFacilityResponse>("nearest-facility", { lat, lon }).catch(
      () => null,
    ),
  ]);

  let address: string | undefined;
  if (mapboxToken) {
    address = await reverseGeocode(lat, lon, mapboxToken);
  }

  return {
    lat,
    lon,
    address,
    classify,
    accessibility,
    nearestFacility,
  };
}

/** Ask the Gemini-powered interpreter to explain the current result. */
export async function fetchAIInterpretation(
  payload: AIInterpretRequest,
  signal?: AbortSignal,
): Promise<AIInterpretResponse> {
  const res = await fetch("/api/ai-interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    throw new Error(`AI interpret returned ${res.status}`);
  }
  return (await res.json()) as AIInterpretResponse;
}

/** Convenience: build an initial interpreter prompt for a new location. */
export function buildInitialQuestion(result: GeoHealthResult): string {
  return "Explain what these results mean for a community health planner in plain language.";
}

export type { ChatMessage };
