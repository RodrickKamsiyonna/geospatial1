/**
 * GeoHealth API — shared TypeScript types.
 *
 * These mirror the Pydantic models returned by the FastAPI backend
 * (ClassifyResponse, AccessibilityResponse, NearestFacilityResponse)
 * plus a composite GeoHealthResult that the dashboard works with.
 */

export interface ClassifyRequest {
  lat: number;
  lon: number;
}

export interface ClassifyResponse {
  location_type: string;
  classification_reason: string;
  smod_code: number | null;
  ghsl_version: string;
  ruleset_version: string;
}

export interface AccessibilityResponse {
  accessibility_score: number | null;
  facilities_per_100k: number | null;
  status: "underserved" | "served" | "overserved" | "unknown";
  ghsl_version: string;
  ruleset_version: string;
}

export interface NearestFacilityResponse {
  facility_name: string;
  facility_lat: number;
  facility_lon: number;
  straight_line_distance_km: number;
  driving_distance_km: number | null;
  travel_time_minutes: number | null;
  routing_status: string;
}

export interface GeoHealthResult {
  lat: number;
  lon: number;
  address?: string;
  classify: ClassifyResponse | null;
  accessibility: AccessibilityResponse | null;
  nearestFacility: NearestFacilityResponse | null;
}

/** A single chat turn with the Gemini-powered interpreter. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Optional timestamp for rendering. */
  ts?: number;
}

/** Payload sent to the /api/ai-interpret endpoint. */
export interface AIInterpretRequest {
  /** The freshly-fetched GeoHealth result for the active location. */
  result: GeoHealthResult;
  /** The user's natural-language follow-up question, if any. */
  question?: string;
  /** Conversation history for multi-turn chat. */
  history?: ChatMessage[];
}

/** Response from /api/ai-interpret. */
export interface AIInterpretResponse {
  reply: string;
  /** Whether this was served from a fallback instead of the live LLM. */
  fallback?: boolean;
  error?: string;
}
