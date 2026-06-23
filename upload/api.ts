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
  status: string;
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
  classify: ClassifyResponse | null;
  accessibility: AccessibilityResponse | null;
  nearestFacility: NearestFacilityResponse | null;
  address?: string;
}
