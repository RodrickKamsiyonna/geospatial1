/**
 * /api/geohealth — Next.js proxy to the GeoHealth FastAPI backend.
 *
 * Why a proxy?
 *  - Keeps the upstream URL (and any future auth) server-side.
 *  - Lets us transparently fall back to deterministic mock data when
 *    the upstream is unreachable from this preview sandbox, so the
 *    dashboard is always demoable.
 *
 * Usage from client:
 *   POST /api/geohealth?endpoint=classify
 *   POST /api/geohealth?endpoint=classify-accessibility
 *   POST /api/geohealth?endpoint=nearest-facility
 *   body: { lat, lon }
 */

import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL || "http://40.127.14.89:8010";

const UPSTREAM_TIMEOUT_MS = 4000;

// ---------------------------------------------------------------------------
// Nigeria reference data — used only when the upstream is unreachable.
// ---------------------------------------------------------------------------

type City = { name: string; lat: number; lon: number; pop: number };
type Facility = { name: string; lat: number; lon: number };

const NIGERIA_CITIES: City[] = [
  { name: "Lagos", lat: 6.5244, lon: 3.3792, pop: 15_388_000 },
  { name: "Kano", lat: 12.0022, lon: 8.5919, pop: 4_103_000 },
  { name: "Ibadan", lat: 7.3775, lon: 3.9470, pop: 3_565_000 },
  { name: "Abuja", lat: 9.0765, lon: 7.3986, pop: 3_464_000 },
  { name: "Port Harcourt", lat: 4.8156, lon: 7.0498, pop: 3_171_000 },
  { name: "Benin City", lat: 6.3350, lon: 5.6037, pop: 1_782_000 },
  { name: "Kaduna", lat: 10.5222, lon: 7.4589, pop: 1_652_000 },
  { name: "Enugu", lat: 6.5244, lon: 7.5078, pop: 1_365_000 },
  { name: "Aba", lat: 5.1066, lon: 7.3667, pop: 1_276_000 },
  { name: "Onitsha", lat: 6.1561, lon: 6.7959, pop: 1_113_000 },
  { name: "Maiduguri", lat: 11.8333, lon: 13.1514, pop: 1_112_000 },
  { name: "Jos", lat: 9.9280, lon: 8.8921, pop: 900_000 },
  { name: "Ilorin", lat: 8.4799, lon: 4.5418, pop: 909_000 },
  { name: "Calabar", lat: 4.9757, lon: 8.3417, pop: 580_000 },
  { name: "Sokoto", lat: 13.0059, lon: 5.2476, pop: 563_000 },
];

const MOCK_FACILITIES: Facility[] = [
  { name: "Lagos University Teaching Hospital", lat: 6.5155, lon: 3.3880 },
  { name: "Ibadan University College Hospital", lat: 7.4280, lon: 3.9115 },
  { name: "National Hospital Abuja", lat: 9.0765, lon: 7.4386 },
  { name: "Aminu Kano Teaching Hospital", lat: 12.0215, lon: 8.5849 },
  { name: "University of Port Harcourt Teaching Hospital", lat: 4.8902, lon: 6.9320 },
  { name: "University of Benin Teaching Hospital", lat: 6.4037, lon: 5.6137 },
  { name: "Barau Dikko Teaching Hospital, Kaduna", lat: 10.5300, lon: 7.4400 },
  { name: "Enugu State University Teaching Hospital", lat: 6.4845, lon: 7.5256 },
  { name: "University of Maiduguri Teaching Hospital", lat: 11.7900, lon: 13.1300 },
  { name: "Jos University Teaching Hospital", lat: 9.9350, lon: 8.8730 },
  { name: "University of Ilorin Teaching Hospital", lat: 8.4900, lon: 4.5500 },
  { name: "Calabar General Hospital", lat: 4.9700, lon: 8.3300 },
  { name: "Usmanu Danfodiyo University Teaching Hospital, Sokoto", lat: 13.0100, lon: 5.2500 },
  { name: "Federal Medical Centre, Abeokuta", lat: 7.1550, lon: 3.3450 },
  { name: "Federal Medical Centre, Owerri", lat: 5.4900, lon: 7.0350 },
  { name: "Federal Medical Centre, Yola", lat: 9.2300, lon: 12.4600 },
  { name: "Federal Medical Centre, Keffi", lat: 8.8470, lon: 7.8730 },
  { name: "Niger Delta University Teaching Hospital", lat: 5.1100, lon: 6.2100 },
  { name: "Garki Hospital, Abuja", lat: 9.0250, lon: 7.4880 },
  { name: "Eko Hospital, Lagos", lat: 6.4470, lon: 3.4280 },
];

// ---------------------------------------------------------------------------
// Geo helpers (Haversine, mostly)
// ---------------------------------------------------------------------------

const R_EARTH_KM = 6371;
function toRad(d: number) {
  return (d * Math.PI) / 180;
}
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** True if the coordinate is roughly outside Nigeria's bounding box. */
function isOutsideNigeria(lat: number, lon: number): boolean {
  // Nigeria bbox: ~4°N–14°N, ~3°E–15°E
  return lat < 4.0 || lat > 14.1 || lon < 2.6 || lon > 14.7;
}

// ---------------------------------------------------------------------------
// Mock classify endpoint — GHS-SMOD R2023A degree-of-urbanisation ruleset
// ---------------------------------------------------------------------------

const SMOD_MAPPING: Record<
  number,
  { location_type: string; classification_reason: string }
> = {
  30: { location_type: "high-density urban", classification_reason: "SMOD class 30 — Urban Centre" },
  21: { location_type: "urban", classification_reason: "SMOD class 21 — Urban Cluster" },
  22: { location_type: "urban", classification_reason: "SMOD class 22 — Urban Cluster" },
  23: { location_type: "suburban", classification_reason: "SMOD class 23 — Suburban / Peri-urban" },
  11: { location_type: "rural", classification_reason: "SMOD class 11 — Rural cluster" },
  12: { location_type: "rural", classification_reason: "SMOD class 12 — Low-density rural" },
  13: { location_type: "rural", classification_reason: "SMOD class 13 — Scattered rural" },
  10: { location_type: "unknown", classification_reason: "SMOD class 10 — Water / No data" },
};

function mockSmodCode(lat: number, lon: number): number | null {
  if (isOutsideNigeria(lat, lon)) return null;

  // South of the coastline → water / no data
  if (lat < 4.2 && lon < 8.5) {
    const coastLat = 4.3 + 0.15 * Math.sin(toRad(lon * 60));
    if (lat < coastLat) return 10;
  }

  // Find distance to nearest major city; classify by pop & distance.
  let nearest: City | null = null;
  let nearestKm = Infinity;
  let secondKm = Infinity;
  for (const c of NIGERIA_CITIES) {
    const d = haversineKm(lat, lon, c.lat, c.lon);
    if (d < nearestKm) {
      secondKm = nearestKm;
      nearestKm = d;
      nearest = c;
    } else if (d < secondKm) {
      secondKm = d;
    }
  }
  if (!nearest) return 11;

  // Urban centre core: very close to a >5M city
  if (nearest.pop > 5_000_000 && nearestKm < 15) return 30;
  // Urban cluster: city itself or close-in
  if (nearestKm < 6) return nearest.pop > 2_000_000 ? 21 : 22;
  // Suburban fringe
  if (nearestKm < 18) return 23;
  // Second-city influence
  if (secondKm < 25) return 23;
  // Rural — denser near settlements, scattered far away
  if (nearestKm < 60) return 11;
  if (nearestKm < 150) return 12;
  return 13;
}

function mockClassify(lat: number, lon: number) {
  const code = mockSmodCode(lat, lon);
  if (code === null) {
    return {
      location_type: "unknown",
      classification_reason: "Coordinates outside Nigeria coverage",
      smod_code: null,
      ghsl_version: "R2023A",
      ruleset_version: "V1.0",
    };
  }
  const m = SMOD_MAPPING[code] ?? {
    location_type: "unknown",
    classification_reason: `Unexpected SMOD code ${code}`,
  };
  return {
    ...m,
    smod_code: code,
    ghsl_version: "R2023A",
    ruleset_version: "V1.0",
  };
}

// ---------------------------------------------------------------------------
// Mock accessibility — supply/demand ratio derived from facility density
// ---------------------------------------------------------------------------

function mockAccessibility(lat: number, lon: number) {
  if (isOutsideNigeria(lat, lon)) {
    return {
      accessibility_score: null,
      facilities_per_100k: null,
      status: "unknown" as const,
      ghsl_version: "R2023A",
      ruleset_version: "V1.0",
    };
  }

  // Count facilities within 50 km, weighted by inverse distance.
  let weighted = 0;
  let nearestKm = Infinity;
  for (const f of MOCK_FACILITIES) {
    const d = haversineKm(lat, lon, f.lat, f.lon);
    if (d < 50) {
      weighted += 1 / (1 + d * 0.25);
    }
    if (d < nearestKm) nearestKm = d;
  }

  // Estimate population pressure from nearest-city proximity.
  let cityPop = 200_000;
  let cityDistKm = 30;
  for (const c of NIGERIA_CITIES) {
    const d = haversineKm(lat, lon, c.lat, c.lon);
    if (d < cityDistKm) {
      cityDistKm = d;
      cityPop = c.pop;
    }
  }

  // Score = supply (facilities) / demand (population proxy).
  // Scale to a reasonable 0–0.003 range (3 facilities per 1k ppl = 0.003).
  const popProxy = cityPop * (1 / (1 + cityDistKm * 0.05));
  const score = Math.min(0.003, weighted / Math.max(50_000, popProxy));

  const facilities_per_100k = score * 100_000;

  let status: "underserved" | "served" | "overserved";
  if (facilities_per_100k < 20) status = "underserved";
  else if (facilities_per_100k > 200) status = "overserved";
  else status = "served";

  return {
    accessibility_score: score,
    facilities_per_100k,
    status,
    ghsl_version: "R2023A",
    ruleset_version: "V1.0",
  };
}

// ---------------------------------------------------------------------------
// Mock nearest-facility (uses Mapbox-style straight-line + road estimate)
// ---------------------------------------------------------------------------

function mockNearestFacility(lat: number, lon: number) {
  if (isOutsideNigeria(lat, lon)) {
    throw new Error("outside_nigeria");
  }
  let nearest: Facility | null = null;
  let nearestKm = Infinity;
  for (const f of MOCK_FACILITIES) {
    const d = haversineKm(lat, lon, f.lat, f.lon);
    if (d < nearestKm) {
      nearestKm = d;
      nearest = f;
    }
  }
  if (!nearest) throw new Error("no_facility");

  // Driving distance ~1.28× straight line; assume 38 km/h average rural+urban mix.
  const driveKm = +(nearestKm * 1.28).toFixed(2);
  const driveMin = +((driveKm / 38) * 60).toFixed(2);

  return {
    facility_name: nearest.name,
    facility_lat: nearest.lat,
    facility_lon: nearest.lon,
    straight_line_distance_km: +nearestKm.toFixed(2),
    driving_distance_km: driveKm,
    travel_time_minutes: driveMin,
    routing_status: "success",
  };
}

// ---------------------------------------------------------------------------
// Upstream caller with timeout
// ---------------------------------------------------------------------------

async function callUpstream(
  endpoint: string,
  body: { lat: number; lon: number },
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE_URL}/v1/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");
  const body = await request.json().catch(() => ({}));
  const { lat, lon } = body ?? {};

  if (!endpoint || typeof lat !== "number" || typeof lon !== "number") {
    return NextResponse.json(
      { error: "endpoint, lat, lon are required" },
      { status: 400 },
    );
  }

  // Try the real backend first.
  try {
    const upstream = await callUpstream(endpoint, { lat, lon });
    if (upstream.ok) {
      const data = await upstream.json();
      return NextResponse.json(data);
    }
    // Non-2xx → fall through to mock.
    console.warn(
      `[geohealth] upstream ${endpoint} returned ${upstream.status}, using mock`,
    );
  } catch (err) {
    console.warn(
      `[geohealth] upstream ${endpoint} unreachable (${(err as Error).message}), using mock`,
    );
  }

  // Fallback to deterministic mock.
  try {
    let mock;
    switch (endpoint) {
      case "classify":
        mock = mockClassify(lat, lon);
        break;
      case "classify-accessibility":
        mock = mockAccessibility(lat, lon);
        break;
      case "nearest-facility":
        mock = mockNearestFacility(lat, lon);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown endpoint: ${endpoint}` },
          { status: 404 },
        );
    }
    return NextResponse.json(mock);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "mock_failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "geohealth-proxy",
    upstream: API_BASE_URL,
    fallback: "deterministic-mock",
  });
}
