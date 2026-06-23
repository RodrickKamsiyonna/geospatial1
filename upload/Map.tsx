'use client';

import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeoHealthResult } from '../types/api';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface MapProps {
  onLocationSelect: (lat: number, lon: number) => void;
  apiResult: GeoHealthResult | null;
  isMapLoaded: boolean;
  setIsMapLoaded: (loaded: boolean) => void;
  selectedCoords?: { lat: number, lon: number } | null;
}

export default function Map({ onLocationSelect, apiResult, isMapLoaded, setIsMapLoaded, selectedCoords }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const facilityMarker = useRef<mapboxgl.Marker | null>(null);

  const updateUserMarker = (lng: number, lat: number) => {
    if (!map.current) return;

    // Create custom pulse marker element
    if (!userMarker.current) {
        const el = document.createElement('div');
        el.className = 'pulse-marker';
        userMarker.current = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(map.current);
    } else {
        userMarker.current.setLngLat([lng, lat]);
    }

    // Fly to location
    map.current.flyTo({
        center: [lng, lat],
        zoom: 12,
        essential: true,
        duration: 2000
    });
  };

  // Initialize Map
  useEffect(() => {
    if (map.current || !mapContainer.current || !mapboxgl.accessToken) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [8.6753, 9.0820], // Center on Nigeria
      zoom: 5.5,
      pitch: 45, // Add a bit of 3D tilt
    });

    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    map.current.on('load', () => {
      setIsMapLoaded(true);

      // Add a 3D building layer (optional flair)
      if (map.current) {
        const layers = map.current.getStyle()?.layers;
        if (layers) {
            const labelLayerId = layers.find(
            (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
            )?.id;

            map.current.addLayer(
            {
                'id': 'add-3d-buildings',
                'source': 'composite',
                'source-layer': 'building',
                'filter': ['==', 'extrude', 'true'],
                'type': 'fill-extrusion',
                'minzoom': 15,
                'paint': {
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': [
                    'interpolate', ['linear'], ['zoom'],
                    15, 0,
                    15.05, ['get', 'height']
                ],
                'fill-extrusion-base': [
                    'interpolate', ['linear'], ['zoom'],
                    15, 0,
                    15.05, ['get', 'min_height']
                ],
                'fill-extrusion-opacity': 0.6
                }
            },
            labelLayerId
            );
        }
      }
    });

    // Handle map clicks
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      updateUserMarker(lng, lat);
      onLocationSelect(lat, lng);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [setIsMapLoaded, onLocationSelect]);

  const clearRouteAndFacility = () => {
      if (!map.current) return;
      if (facilityMarker.current) {
          facilityMarker.current.remove();
          facilityMarker.current = null;
      }
      if (map.current.getSource('route')) {
          (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
      }
  };

  const updateFacilityMarkerAndRoute = async (userLng: number, userLat: number, facLng: number, facLat: number, facName: string) => {
      if (!map.current || !mapboxgl.accessToken) return;

      // Add Facility Marker
      if (!facilityMarker.current) {
          const el = document.createElement('div');
          el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-activity"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M17 12h-2l-2 5-2-10-2 5H7"/></svg>`;
          el.style.backgroundColor = 'white';
          el.style.borderRadius = '50%';
          el.style.padding = '4px';
          el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

          facilityMarker.current = new mapboxgl.Marker(el)
            .setLngLat([facLng, facLat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<div class="font-bold">${facName}</div>`))
            .addTo(map.current);
      } else {
          facilityMarker.current.setLngLat([facLng, facLat]);
          facilityMarker.current.getPopup()?.setHTML(`<div class="font-bold">${facName}</div>`);
      }

      // Fetch Directions for Route Line
      try {
        const query = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${userLng},${userLat};${facLng},${facLat}?geometries=geojson&access_token=${mapboxgl.accessToken}`
        );
        const json = await query.json();

        const data = json.routes[0];
        if (data && data.geometry) {
            const route = data.geometry.coordinates;
            const geojson = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: route
                }
            };

            if (map.current.getSource('route')) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(geojson as any);
            } else {
                map.current.addSource('route', {
                    type: 'geojson',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data: geojson as any
                });
                map.current.addLayer({
                    id: 'route',
                    type: 'line',
                    source: 'route',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#34d399',
                        'line-width': 4,
                        'line-dasharray': [0, 2, 2]
                    }
                });
            }

            // Fit bounds to show both markers
            const bounds = new mapboxgl.LngLatBounds([userLng, userLat], [userLng, userLat]);
            bounds.extend([facLng, facLat]);
            map.current.fitBounds(bounds, {
                padding: { top: 100, bottom: 100, left: 400, right: 100 }, // Leave room for sidebar
                maxZoom: 14,
                duration: 2000
            });
        }
      } catch (error) {
          console.error("Failed to fetch mapbox route", error);
          // Fallback to straight line if routing fails
           const geojson = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: [[userLng, userLat], [facLng, facLat]]
                }
            };

            if (map.current.getSource('route')) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(geojson as any);
            } else {
                map.current.addSource('route', {
                    type: 'geojson',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data: geojson as any
                });
                map.current.addLayer({
                    id: 'route',
                    type: 'line',
                    source: 'route',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#64748b',
                        'line-width': 2,
                        'line-dasharray': [2, 4]
                    }
                });
            }
      }
  };

  // Handle Updates from API Result
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
            apiResult.nearestFacility.facility_name
         );
       } else {
         clearRouteAndFacility();
       }
    } else {
       // Clear everything if apiResult is null
       clearRouteAndFacility();
       if (userMarker.current) {
         userMarker.current.remove();
         userMarker.current = null;
       }
    }
  }, [apiResult, isMapLoaded]);

  // Handle Updates from selectedCoords
  useEffect(() => {
    if (selectedCoords && isMapLoaded) {
      updateUserMarker(selectedCoords.lon, selectedCoords.lat);
    }
  }, [selectedCoords, isMapLoaded]);

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Fallback light background while map loads */}
      <div className="absolute inset-0 bg-slate-50 -z-10" />
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
