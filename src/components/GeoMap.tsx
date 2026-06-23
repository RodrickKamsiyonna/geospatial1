"use client";

/**
 * GeoMap — Mapbox GL JS map with smart fallback.
 *
 * - If NEXT_PUBLIC_MAPBOX_TOKEN is set, uses Mapbox dark-v11 style and
 *   Mapbox Directions API for the route line.
 * - If no token is present (e.g., preview sandbox), falls back to a
 *   free OpenStreetMap raster tile layer so the dashboard is always
 *   demoable. Routing then degrades to a straight line.
 *
 * The map is designed to be the visual centrepiece of the dashboard:
 *  - Pulse marker for the user's selected location
 *  - Custom hospital icon for the nearest facility
 *  - Animated dashed route line between the two
 *  - 3D building extrusion at high zoom for urban context
 */

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoHealthResult } from "@/types/geohealth";

interface GeoMapProps {
  onLocationSelect: (lat: number, lon: number) => void;
  apiResult: GeoHealthResult | null;
  isMapLoaded: boolean;
  setIsMapLoaded: (loaded: boolean) => void;
  selectedCoords?: { lat: number; lon: number } | null;
}

const FALLBACK_TILE_URL =
  "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png";
const FALLBACK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function GeoMap({
  onLocationSelect,
  apiResult,
  isMapLoaded,
  setIsMapLoaded,
  selectedCoords,
}: GeoMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const facilityMarker = useRef<mapboxgl.Marker | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const hasMapbox = Boolean(token);

  // -----------------------------------------------------------------
  // Initialise map once.
  // -----------------------------------------------------------------
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    if (hasMapbox) {
      mapboxgl.accessToken = token;
    }

    const style: mapboxgl.StyleSpecification = hasMapbox
      ? ("mapbox://styles/mapbox/dark-v11" as mapboxgl.StyleSpecification)
      : {
          version: 8,
          sources: {
            "raster-tiles": {
              type: "raster",
              tiles: [
                FALLBACK_TILE_URL,
                "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
                "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              ],
              tileSize: 256,
              attribution: FALLBACK_ATTRIBUTION,
              maxzoom: 20,
            },
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#060B16" },
            },
            {
              id: "raster-layer",
              type: "raster",
              source: "raster-tiles",
              minzoom: 0,
              maxzoom: 22,
              paint: {
                "raster-saturation": -0.2,
                "raster-opacity": 0.92,
              },
            },
          ],
        };

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style,
      center: [8.6753, 9.082], // Centre on Nigeria
      zoom: 5.6,
      pitch: 30,
      bearing: 0,
      attributionControl: true,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "bottom-right",
    );
    map.current.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.current.on("load", () => {
      setIsMapLoaded(true);

      // Add subtle 3D building extrusion for urban context (Mapbox only).
      if (map.current && hasMapbox) {
        const layers = map.current.getStyle()?.layers;
        if (layers) {
          const labelLayerId = layers.find(
            (layer) =>
              layer.type === "symbol" &&
              layer.layout &&
              layer.layout["text-field"],
          )?.id;

          map.current.addLayer(
            {
              id: "add-3d-buildings",
              source: "composite",
              "source-layer": "building",
              filter: ["==", "extrude", "true"],
              type: "fill-extrusion",
              minzoom: 14,
              paint: {
                "fill-extrusion-color": "#1a2942",
                "fill-extrusion-height": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  14,
                  0,
                  14.05,
                  ["get", "height"],
                ],
                "fill-extrusion-base": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  14,
                  0,
                  14.05,
                  ["get", "min_height"],
                ],
                "fill-extrusion-opacity": 0.55,
              },
            },
            labelLayerId,
          );
        }
      }
    });

    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      onLocationSelect(lat, lng);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        userMarker.current = null;
        facilityMarker.current = null;
      }
    };
  }, [token]);

  // -----------------------------------------------------------------
  // User pulse marker — placed whenever selectedCoords changes.
  const updateUserMarker = (lng: number, lat: number) => {
    if (!map.current) return;

    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "pulse-marker";
      userMarker.current = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([lng, lat]);
    }

    map.current.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.current.getZoom(), 11),
      essential: true,
      duration: 1800,
    });
  };

  // -----------------------------------------------------------------
  // Facility marker + route line — placed when apiResult has a facility.
  // -----------------------------------------------------------------
  const clearRouteAndFacility = () => {
    if (!map.current) return;
    if (facilityMarker.current) {
      facilityMarker.current.remove();
      facilityMarker.current = null;
    }
    if (map.current.getSource("route")) {
      (
        map.current.getSource("route") as mapboxgl.GeoJSONSource
      ).setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [] },
      } as any);
    }
  };

  const drawRoute = (
    userLng: number,
    userLat: number,
    facLng: number,
    facLat: number,
    useDirectionsApi: boolean,
  ) => {
    if (!map.current) return;

    const drawLine = (coords: number[][], color: string, dashed: boolean) => {
      const geojson = {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      };

      if (map.current!.getSource("route")) {
        (
          map.current!.getSource("route") as mapboxgl.GeoJSONSource
        ).setData(geojson as any);
      } else {
        map.current!.addSource("route", { type: "geojson", data: geojson as any });
        map.current!.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": color,
            "line-width": 4,
            "line-dasharray": dashed ? [0, 2, 2] : [1],
          },
        });
      }
    };

    if (useDirectionsApi && hasMapbox) {
      fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${userLng},${userLat};${facLng},${facLat}?geometries=geojson&access_token=${token}`,
      )
        .then((r) => r.json())
        .then((json) => {
          const data = json?.routes?.[0];
          if (data?.geometry?.coordinates?.length) {
            drawLine(data.geometry.coordinates, "#2DD4BF", true);
            fitToBounds(userLng, userLat, facLng, facLat);
          } else {
            drawLine(
              [
                [userLng, userLat],
                [facLng, facLat],
              ],
              "#2DD4BF",
              true,
            );
            fitToBounds(userLng, userLat, facLng, facLat);
          }
        })
        .catch(() => {
          drawLine(
            [
              [userLng, userLat],
              [facLng, facLat],
            ],
            "#94A3B8",
            true,
          );
          fitToBounds(userLng, userLat, facLng, facLat);
        });
    } else {
      drawLine(
        [
          [userLng, userLat],
          [facLng, facLat],
        ],
        "#2DD4BF",
        true,
      );
      fitToBounds(userLng, userLat, facLng, facLat);
    }
  };

  const fitToBounds = (
    userLng: number,
    userLat: number,
    facLng: number,
    facLat: number,
  ) => {
    if (!map.current) return;
    const bounds = new mapboxgl.LngLatBounds(
      [userLng, userLat],
      [userLng, userLat],
    );
    bounds.extend([facLng, facLat]);
    map.current.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 420, right: 80 },
      maxZoom: 13,
      duration: 1600,
    });
  };

  const updateFacilityMarkerAndRoute = (
    userLng: number,
    userLat: number,
    facLng: number,
    facLat: number,
    facName: string,
  ) => {
    if (!map.current) return;

    // Build or update facility marker.
    if (!facilityMarker.current) {
      const el = document.createElement("div");
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FB7185" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
      el.style.backgroundColor = "rgba(11, 20, 38, 0.9)";
      el.style.border = "1.5px solid rgba(251, 113, 133, 0.5)";
      el.style.borderRadius = "50%";
      el.style.padding = "3px";
      el.style.boxShadow = "0 4px 14px rgba(0,0,0,0.6)";
      el.style.cursor = "pointer";

      facilityMarker.current = new mapboxgl.Marker(el)
        .setLngLat([facLng, facLat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
            `<div style="font-weight:600;color:#F1F5F9;">${facName}</div>`,
          ),
        )
        .addTo(map.current);
    } else {
      facilityMarker.current.setLngLat([facLng, facLat]);
      facilityMarker.current
        .getPopup()
        ?.setHTML(
          `<div style="font-weight:600;color:#F1F5F9;">${facName}</div>`,
        );
    }

    drawRoute(userLng, userLat, facLng, facLat, true);
  };

  // -----------------------------------------------------------------
  // React to apiResult changes.
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    if (apiResult) {
      updateUserMarker(apiResult.lon, apiResult.lat);
      if (apiResult.nearestFacility) {
        updateFacilityMarkerAndRoute(
          apiResult.lon,
          apiResult.lat,
          apiResult.nearestFacility.facility_lon,
          apiResult.nearestFacility.facility_lat,
          apiResult.nearestFacility.facility_name,
        );
      } else {
        clearRouteAndFacility();
      }
    } else {
      clearRouteAndFacility();
      if (userMarker.current) {
        userMarker.current.remove();
        userMarker.current = null;
      }
    }
  }, [apiResult, isMapLoaded]);

  // React to manual coordinate selection.
  useEffect(() => {
    if (selectedCoords && isMapLoaded) {
      updateUserMarker(selectedCoords.lon, selectedCoords.lat);
    }
  }, [selectedCoords, isMapLoaded]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <div className="absolute inset-0 bg-[#060B16] -z-10" />
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
