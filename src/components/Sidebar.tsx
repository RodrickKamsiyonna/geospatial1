"use client";

/**
 * Sidebar — the analytics panel on the left of the map.
 *
 * Contains:
 *  - Brand header + action buttons (save / export)
 *  - Coordinate search form (lat/lon input)
 *  - Quick-jump chips for major Nigerian cities
 *  - Selected-location card with reverse-geocoded address
 *  - SMOD classification card with tier icon
 *  - Accessibility card with a segmented gauge
 *  - Nearest-facility card with drive distance + ETA
 *
 * The whole panel is the export target for PDF reports.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Trees,
  Home,
  Navigation,
  MapPin,
  Activity,
  HelpCircle,
  Save,
  Download,
  Search,
  Sparkles,
  Crosshair,
  Clock,
  Route as RouteIcon,
} from "lucide-react";
import type { GeoHealthResult } from "@/types/geohealth";
import { cn } from "@/lib/utils";

interface SidebarProps {
  apiResult: GeoHealthResult | null;
  loading: boolean;
  onSaveLocation: () => void;
  onExportPDF: () => void;
  onLocationSubmit: (lat: number, lon: number) => void;
  onAskAI: () => void;
}

const QUICK_JUMPS = [
  { name: "Lagos", lat: 6.5244, lon: 3.3792 },
  { name: "Abuja", lat: 9.0765, lon: 7.3986 },
  { name: "Kano", lat: 12.0022, lon: 8.5919 },
  { name: "Port Harcourt", lat: 4.8156, lon: 7.0498 },
  { name: "Enugu", lat: 6.5244, lon: 7.5078 },
  { name: "Maiduguri", lat: 11.8333, lon: 13.1514 },
];

function renderSMODIcon(type?: string) {
  switch (type) {
    case "high-density urban":
      return <Building2 className="w-7 h-7 text-[#FB7185]" />;
    case "urban":
      return <Building2 className="w-7 h-7 text-[#FBBF24]" />;
    case "suburban":
      return <Home className="w-7 h-7 text-[#38BDF8]" />;
    case "rural":
      return <Trees className="w-7 h-7 text-[#34D399]" />;
    default:
      return <HelpCircle className="w-7 h-7 text-slate-500" />;
  }
}

function statusColor(status?: string) {
  switch (status) {
    case "overserved":
    case "served":
      return "text-[#34D399]";
    case "underserved":
      return "text-[#FB7185]";
    default:
      return "text-[#FBBF24]";
  }
}

function statusBg(status?: string) {
  switch (status) {
    case "overserved":
    case "served":
      return "bg-[#34D399]";
    case "underserved":
      return "bg-[#FB7185]";
    default:
      return "bg-[#FBBF24]";
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case "served":
      return "Adequately served";
    case "overserved":
      return "Overserved";
    case "underserved":
      return "Underserved";
    default:
      return "Unknown";
  }
}

export default function Sidebar({
  apiResult,
  loading,
  onSaveLocation,
  onExportPDF,
  onLocationSubmit,
  onAskAI,
}: SidebarProps) {
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");

  const handleCoordinateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      onLocationSubmit(lat, lon);
    }
  };

  const renderGauge = (
    score: number | null | undefined,
    status: string | undefined,
  ) => {
    const fpc = score != null ? score * 100_000 : 0;
    // Map 0..200+ facilities-per-100k to 0..100% of the gauge.
    const pct = Math.min(100, Math.max(0, (fpc / 200) * 100));
    return (
      <div className="w-full mt-4">
        <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
          <span>0 · Underserved</span>
          <span>20 · Floor</span>
          <span>200+ · Overserved</span>
        </div>
        <div className="relative h-2.5 w-full rounded-full gauge-track overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className={cn("h-full rounded-full", statusBg(status))}
          />
          {/* WHO 20-per-100k floor marker */}
          <div
            className="absolute top-0 bottom-0 w-px bg-white/40"
            style={{ left: "10%" }}
            title="WHO 20 per 100k floor"
          />
        </div>
        <div className="flex items-baseline justify-between mt-3">
          <div>
            <div className="text-2xl font-bold font-mono text-white">
              {fpc ? fpc.toFixed(1) : "—"}
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Facilities / 100k
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Raw score
            </div>
            <div className="text-xs font-mono text-slate-300">
              {score != null ? score.toFixed(6) : "—"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ x: -440, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 80, damping: 18 }}
      id="export-content"
      className="absolute top-4 left-4 z-10 w-[calc(100%-2rem)] sm:w-[400px] max-h-[calc(100vh-2rem)] flex flex-col glass-panel rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[#0E1B33] to-transparent">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#2DD4BF] to-[#38BDF8] flex items-center justify-center shadow-lg shadow-[#2DD4BF]/30">
            <Activity className="w-5 h-5 text-[#04111A]" strokeWidth={2.5} />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#34D399] border-2 border-[#0B1426] animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              GeoHealth
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30">
                AI
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.15em] mt-0.5">
              SMOD · Accessibility · Gemini
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onSaveLocation}
            disabled={!apiResult || loading}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30 text-slate-300 hover:text-[#2DD4BF]"
            title="Save location to compare"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={onExportPDF}
            disabled={!apiResult || loading}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30 text-slate-300 hover:text-[#38BDF8]"
            title="Export PDF report"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Coordinate search form */}
      <form
        onSubmit={handleCoordinateSubmit}
        className="p-4 border-b border-white/5 flex flex-col gap-3"
      >
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1 block">
              Latitude
            </label>
            <input
              type="number"
              step="any"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              placeholder="9.0820"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2DD4BF]/60 transition-colors font-mono"
              required
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1 block">
              Longitude
            </label>
            <input
              type="number"
              step="any"
              value={lonInput}
              onChange={(e) => setLonInput(e.target.value)}
              placeholder="8.6753"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2DD4BF]/60 transition-colors font-mono"
              required
            />
          </div>
          <button
            type="submit"
            className="self-end h-[38px] px-3 rounded-lg bg-[#2DD4BF] hover:bg-[#14B8A6] text-[#04111A] font-semibold transition-colors flex items-center justify-center"
            title="Search coordinates"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Quick jumps */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_JUMPS.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                setLatInput(c.lat.toFixed(4));
                setLonInput(c.lon.toFixed(4));
                onLocationSubmit(c.lat, c.lon);
              }}
              className="px-2.5 py-1 text-[11px] rounded-full bg-white/5 hover:bg-[#2DD4BF]/15 hover:text-[#2DD4BF] text-slate-300 border border-white/10 hover:border-[#2DD4BF]/30 transition-colors"
            >
              {c.name}
            </button>
          ))}
        </div>
      </form>

      {/* Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-4">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-[#2DD4BF]/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#2DD4BF] animate-spin" />
              </div>
              <p className="text-sm text-slate-400 animate-pulse">
                Sampling rasters &amp; routing…
              </p>
              <p className="text-[10px] text-slate-600 font-mono mt-1">
                SMOD · Accessibility · Nearest facility
              </p>
            </motion.div>
          ) : !apiResult ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-14 px-4"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                <Crosshair className="w-8 h-8 text-[#2DD4BF]/60" />
              </div>
              <p className="text-sm text-slate-300 font-medium mb-1">
                Pick a location to analyse
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click anywhere on the map of Nigeria, enter coordinates
                manually, or jump to a major city above.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="flex flex-col gap-3"
            >
              {/* Selected location */}
              <div className="bg-black/20 rounded-xl border border-white/5 p-3.5">
                <h3 className="text-[10px] uppercase text-slate-400 font-mono tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Selected location
                </h3>
                <p className="text-sm text-white font-medium leading-snug line-clamp-2">
                  {apiResult.address || "Unnamed coordinate"}
                </p>
                <div className="flex gap-4 mt-2 text-[11px] font-mono text-slate-400">
                  <span>lat {apiResult.lat.toFixed(4)}°N</span>
                  <span>lon {apiResult.lon.toFixed(4)}°E</span>
                </div>
              </div>

              {/* SMOD classification */}
              <div className="bg-black/20 rounded-xl border border-white/5 p-3.5 relative overflow-hidden">
                <div className="absolute top-2 right-2 opacity-20 pointer-events-none">
                  {renderSMODIcon(apiResult.classify?.location_type)}
                </div>
                <h3 className="text-[10px] uppercase text-slate-400 font-mono tracking-wider mb-2">
                  SMOD classification
                </h3>
                <div className="flex items-center gap-2.5 mb-1">
                  {renderSMODIcon(apiResult.classify?.location_type)}
                  <span className="text-lg font-bold capitalize text-white tracking-tight">
                    {apiResult.classify?.location_type || "Unknown"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {apiResult.classify?.classification_reason ||
                    "No data available for this coordinate."}
                </p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                  <span className="text-[10px] font-mono text-slate-500">
                    Code
                  </span>
                  <span className="text-[10px] font-mono text-[#2DD4BF] font-semibold">
                    {apiResult.classify?.smod_code ?? "N/A"}
                  </span>
                  <span className="text-[10px] text-slate-500">·</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {apiResult.classify?.ghsl_version || "R2023A"}
                  </span>
                </div>
              </div>

              {/* Accessibility */}
              <div className="bg-black/20 rounded-xl border border-white/5 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] uppercase text-slate-400 font-mono tracking-wider">
                    Health accessibility
                  </h3>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                      apiResult.accessibility?.status === "underserved"
                        ? "bg-[#FB7185]/15 text-[#FB7185] border-[#FB7185]/30"
                        : apiResult.accessibility?.status === "served"
                          ? "bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30"
                          : apiResult.accessibility?.status === "overserved"
                            ? "bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30"
                            : "bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30",
                    )}
                  >
                    {statusLabel(apiResult.accessibility?.status)}
                  </span>
                </div>
                {renderGauge(
                  apiResult.accessibility?.accessibility_score,
                  apiResult.accessibility?.status,
                )}
              </div>

              {/* Nearest facility */}
              <div className="bg-black/20 rounded-xl border border-white/5 p-3.5">
                <h3 className="text-[10px] uppercase text-slate-400 font-mono tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Navigation className="w-3 h-3" /> Nearest facility
                </h3>

                {apiResult.nearestFacility ? (
                  <div className="space-y-2.5">
                    <p className="font-semibold text-white text-sm leading-snug">
                      {apiResult.nearestFacility.facility_name}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                          <RouteIcon className="w-3 h-3" /> Drive
                        </div>
                        <div className="font-mono text-sm text-[#34D399] font-semibold">
                          {apiResult.nearestFacility.driving_distance_km != null
                            ? `${apiResult.nearestFacility.driving_distance_km} km`
                            : "N/A"}
                        </div>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                          <Clock className="w-3 h-3" /> ETA
                        </div>
                        <div className="font-mono text-sm text-[#38BDF8] font-semibold">
                          {apiResult.nearestFacility.travel_time_minutes != null
                            ? `${apiResult.nearestFacility.travel_time_minutes} min`
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span className="font-mono">
                        Straight line:{" "}
                        {apiResult.nearestFacility.straight_line_distance_km}{" "}
                        km
                      </span>
                      <span
                        className={cn(
                          "font-mono",
                          apiResult.nearestFacility.routing_status === "success"
                            ? "text-[#34D399]"
                            : "text-[#FBBF24]",
                        )}
                      >
                        {apiResult.nearestFacility.routing_status}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No facility data available for this coordinate.
                  </p>
                )}
              </div>

              {/* Ask Gemini */}
              <button
                onClick={onAskAI}
                className="w-full mt-1 py-2.5 rounded-xl bg-gradient-to-r from-[#2DD4BF]/15 to-[#38BDF8]/15 hover:from-[#2DD4BF]/25 hover:to-[#38BDF8]/25 border border-[#2DD4BF]/30 text-[#2DD4BF] font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Interpret with Gemini
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
