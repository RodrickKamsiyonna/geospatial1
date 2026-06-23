"use client";

/**
 * ComparisonDrawer — bottom-anchored drawer for comparing up to three
 * saved locations side-by-side.
 *
 * Each saved card shows the location label, SMOD tier, accessibility
 * status, raw score and a remove button. The drawer can be collapsed
 * to just its handle bar so it doesn't obscure the map.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, X, Layers } from "lucide-react";
import type { GeoHealthResult } from "@/types/geohealth";
import { cn } from "@/lib/utils";

interface ComparisonDrawerProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  visible: boolean;
  locations: GeoHealthResult[];
  onRemove: (index: number) => void;
  onSelect: (loc: GeoHealthResult) => void;
}

export default function ComparisonDrawer({
  open,
  setOpen,
  visible,
  locations,
  onRemove,
  onSelect,
}: ComparisonDrawerProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: open ? 0 : "calc(100% - 44px)" }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl z-20 glass-panel rounded-t-2xl flex flex-col shadow-2xl"
        >
          {/* Handle bar */}
          <button
            onClick={() => setOpen(!open)}
            className="h-11 w-full flex items-center justify-between px-5 cursor-pointer hover:bg-white/[0.03] transition-colors rounded-t-2xl border-b border-white/5"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#2DD4BF]" />
              <span className="font-semibold text-white text-xs tracking-tight">
                Compare Locations
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                {locations.length}/3
              </span>
            </div>
            {open ? (
              <Minimize2 className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {/* Cards */}
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto max-h-[40vh] hide-scrollbar">
            {locations.map((loc, idx) => (
              <ComparisonCard
                key={`${loc.lat.toFixed(4)}-${loc.lon.toFixed(4)}-${idx}`}
                loc={loc}
                onRemove={() => onRemove(idx)}
                onSelect={() => onSelect(loc)}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ComparisonCard({
  loc,
  onRemove,
  onSelect,
}: {
  loc: GeoHealthResult;
  onRemove: () => void;
  onSelect: () => void;
}) {
  const status = loc.accessibility?.status;
  const statusColor =
    status === "underserved"
      ? "text-[#FB7185]"
      : status === "served" || status === "overserved"
        ? "text-[#34D399]"
        : "text-[#FBBF24]";

  const tierColor =
    loc.classify?.location_type === "high-density urban"
      ? "text-[#FB7185]"
      : loc.classify?.location_type === "urban"
        ? "text-[#FBBF24]"
        : loc.classify?.location_type === "suburban"
          ? "text-[#38BDF8]"
          : loc.classify?.location_type === "rural"
            ? "text-[#34D399]"
            : "text-slate-400";

  return (
    <div
      onClick={onSelect}
      className="bg-black/30 hover:bg-black/40 p-3.5 rounded-xl border border-white/5 hover:border-[#2DD4BF]/30 transition-all cursor-pointer relative group"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-[#FB7185]/15 text-slate-500 hover:text-[#FB7185] transition-colors opacity-0 group-hover:opacity-100"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <h4 className="text-xs font-bold text-white mb-2 line-clamp-1 pr-6">
        {loc.address?.split(",")[0] ||
          `${loc.lat.toFixed(2)}°N, ${loc.lon.toFixed(2)}°E`}
      </h4>
      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-slate-400">SMOD</span>
          <span className={cn("capitalize font-semibold", tierColor)}>
            {loc.classify?.location_type || "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Status</span>
          <span className={cn("capitalize font-semibold", statusColor)}>
            {status || "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Per 100k</span>
          <span className="font-mono text-slate-200">
            {loc.accessibility?.facilities_per_100k?.toFixed(1) ?? "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Drive</span>
          <span className="font-mono text-[#34D399]">
            {loc.nearestFacility?.driving_distance_km != null
              ? `${loc.nearestFacility.driving_distance_km} km`
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
