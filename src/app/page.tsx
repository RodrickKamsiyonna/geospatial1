"use client";

/**
 * GeoHealth AI — main dashboard page.
 *
 * Layout:
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  Topbar (brand, version chip, data-source status)        │
 *  ├───────────────┬───────────────────────┬──────────────────┤
 *  │               │                       │                  │
 *  │  Sidebar      │      GeoMap           │   AIPanel        │
 *  │  (analytics)  │      (Mapbox)         │   (Gemini chat)  │
 *  │               │                       │                  │
 *  ├───────────────┴───────────────────────┴──────────────────┤
 *  │  ComparisonDrawer (bottom-anchored, collapsible)         │
 *  └──────────────────────────────────────────────────────────┘
 *
 * The map fills the whole viewport behind the panels; the panels are
 * glassmorphic overlays so the map remains visible at all times.
 */

import { useCallback, useEffect, useState } from "react";
import GeoMap from "@/components/GeoMap";
import Sidebar from "@/components/Sidebar";
import AIPanel from "@/components/AIPanel";
import ComparisonDrawer from "@/components/ComparisonDrawer";
import { fetchAllGeoHealthData } from "@/lib/api";
import type { GeoHealthResult } from "@/types/geohealth";
import { motion } from "framer-motion";
import { Activity, Sparkles, ShieldCheck } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function Home() {
  const [apiResult, setApiResult] = useState<GeoHealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [savedLocations, setSavedLocations] = useState<GeoHealthResult[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string>("");

  // On mount, expose the Mapbox token from env to the client for the
  // reverse-geocoding call in lib/api.ts. We read it once, lazily, so
  // it works whether or not the env var is set.
  useEffect(() => {
    setMapboxToken(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "");
  }, []);

  // -----------------------------------------------------------------
  // Location selection → fetch all GeoHealth signals in parallel.
  // -----------------------------------------------------------------
  const handleLocationSelect = useCallback(
    async (lat: number, lon: number) => {
      setSelectedCoords({ lat, lon });
      if (!isMapLoaded) return;

      setLoading(true);
      try {
        const result = await fetchAllGeoHealthData(lat, lon, mapboxToken);
        setApiResult(result);
      } catch (err) {
        console.error("Failed to fetch GeoHealth data", err);
      } finally {
        setLoading(false);
      }
    },
    [isMapLoaded, mapboxToken],
  );

  // -----------------------------------------------------------------
  // Save / remove / select saved locations.
  // -----------------------------------------------------------------
  const handleSaveLocation = () => {
    if (!apiResult) return;
    if (
      savedLocations.find(
        (l) =>
          l.lat === apiResult.lat && l.lon === apiResult.lon,
      )
    )
      return;
    setSavedLocations((prev) => [...prev, apiResult].slice(-3));
    setComparisonOpen(true);
  };

  const handleRemoveSaved = (index: number) => {
    setSavedLocations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectSaved = (loc: GeoHealthResult) => {
    handleLocationSelect(loc.lat, loc.lon);
  };

  // -----------------------------------------------------------------
  // PDF export — capture the Sidebar panel and stamp it onto an A4.
  // -----------------------------------------------------------------
  const handleExportPDF = async () => {
    const element = document.getElementById("export-content");
    if (!element) return;
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: "#0B1426",
        scale: 2,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.setFillColor(11, 20, 38);
      pdf.rect(0, 0, pdfWidth, pdf.internal.pageSize.getHeight(), "F");
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`geohealth-${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    }
  };

  return (
    <main className="relative w-full h-screen overflow-hidden bg-[#060B16]">
      {/* Map fills the viewport behind everything */}
      <GeoMap
        onLocationSelect={handleLocationSelect}
        apiResult={apiResult}
        isMapLoaded={isMapLoaded}
        setIsMapLoaded={setIsMapLoaded}
        selectedCoords={selectedCoords}
      />

      {/* Top bar */}
      <TopBar
        hasResult={!!apiResult}
        loading={loading}
        isMapLoaded={isMapLoaded}
        onOpenAI={() => setAiOpen(true)}
        savedCount={savedLocations.length}
        onOpenComparison={() => setComparisonOpen(true)}
      />

      {/* Sidebar */}
      <Sidebar
        apiResult={apiResult}
        loading={loading}
        onSaveLocation={handleSaveLocation}
        onExportPDF={handleExportPDF}
        onLocationSubmit={handleLocationSelect}
        onAskAI={() => setAiOpen(true)}
      />

      {/* AI panel */}
      <AIPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        result={apiResult}
      />

      {/* Map legend */}
      <Legend />

      {/* Comparison drawer */}
      <ComparisonDrawer
        open={comparisonOpen}
        setOpen={setComparisonOpen}
        visible={savedLocations.length > 0}
        locations={savedLocations}
        onRemove={handleRemoveSaved}
        onSelect={handleSelectSaved}
      />
    </main>
  );
}

// ---------------------------------------------------------------------
// TopBar — slim header chip showing brand, version, and quick actions.
// ---------------------------------------------------------------------

function TopBar({
  hasResult,
  loading,
  isMapLoaded,
  onOpenAI,
  savedCount,
  onOpenComparison,
}: {
  hasResult: boolean;
  loading: boolean;
  isMapLoaded: boolean;
  onOpenAI: () => void;
  savedCount: number;
  onOpenComparison: () => void;
}) {
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1, type: "spring", stiffness: 80, damping: 18 }}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 hidden md:flex items-center gap-3 glass-panel rounded-full px-4 py-2"
    >
      {/* Brand mark */}
      <div className="flex items-center gap-2 pr-3 border-r border-white/10">
        <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-[#2DD4BF] to-[#38BDF8] flex items-center justify-center">
          <Activity className="w-3.5 h-3.5 text-[#04111A]" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-xs font-bold text-white">GeoHealth AI</span>
          <span className="text-[9px] text-slate-400 font-mono">
            v1.1 · GHS-SMOD R2023A
          </span>
        </div>
      </div>

      {/* Status pill */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            loading
              ? "bg-[#FBBF24] animate-pulse"
              : isMapLoaded
                ? "bg-[#34D399]"
                : "bg-slate-500"
          }`}
        />
        <span className="font-mono">
          {loading ? "Analysing…" : isMapLoaded ? "Live" : "Loading map"}
        </span>
      </div>

      {/* AI button */}
      <button
        onClick={onOpenAI}
        disabled={!hasResult}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2DD4BF] bg-[#2DD4BF]/10 hover:bg-[#2DD4BF]/20 border border-[#2DD4BF]/30 rounded-full px-3 py-1 transition-colors disabled:opacity-40"
      >
        <Sparkles className="w-3 h-3" />
        Gemini
      </button>

      {/* Saved locations */}
      {savedCount > 0 && (
        <button
          onClick={onOpenComparison}
          className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1 transition-colors"
        >
          <span className="font-mono">{savedCount}</span> saved
        </button>
      )}

      {/* Data source chip */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pl-3 border-l border-white/10">
        <ShieldCheck className="w-3 h-3 text-[#34D399]" />
        <span>EC JRC · WHO thresholds</span>
      </div>
    </motion.header>
  );
}

// ---------------------------------------------------------------------
// Legend — SMOD tier colour key, bottom-right of the map.
// ---------------------------------------------------------------------

function Legend() {
  const items: Array<{ color: string; label: string; code: string }> = [
    { color: "#FB7185", label: "Urban Centre", code: "30" },
    { color: "#FBBF24", label: "Urban Cluster", code: "21-23" },
    { color: "#38BDF8", label: "Suburban", code: "23" },
    { color: "#34D399", label: "Rural", code: "11-13" },
    { color: "#64748B", label: "Water / No data", code: "10" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="absolute bottom-4 right-4 z-10 glass-panel rounded-xl p-3 max-w-[200px]"
    >
      <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <span className="w-1 h-1 rounded-full bg-[#2DD4BF]" />
        SMOD Legend
      </h4>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li
            key={it.code}
            className="flex items-center gap-2 text-[11px] text-slate-300"
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: it.color }}
            />
            <span className="flex-1">{it.label}</span>
            <span className="font-mono text-[10px] text-slate-500">
              {it.code}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
