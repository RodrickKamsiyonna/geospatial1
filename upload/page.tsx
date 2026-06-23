'use client';

import React, { useState } from 'react';
import Map from '../components/Map';
import Sidebar, { cn } from '../components/Sidebar';
import { fetchAllGeoHealthData } from '../lib/api';
import { GeoHealthResult } from '../types/api';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function Home() {
  const [apiResult, setApiResult] = useState<GeoHealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [savedLocations, setSavedLocations] = useState<GeoHealthResult[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{lat: number, lon: number} | null>(null);

  const handleLocationSelect = async (lat: number, lon: number) => {
    setSelectedCoords({lat, lon});
    if (!isMapLoaded) return;

    setLoading(true);
    try {
      const result = await fetchAllGeoHealthData(lat, lon);
      setApiResult(result);
    } catch (error) {
      console.error("Failed to fetch location data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLocation = () => {
    if (apiResult && !savedLocations.find(l => l.lat === apiResult.lat && l.lon === apiResult.lon)) {
      setSavedLocations(prev => [...prev, apiResult].slice(-3)); // Keep max 3
      setIsComparisonOpen(true);
    }
  };

  const handleRemoveSavedLocation = (index: number) => {
      setSavedLocations(prev => prev.filter((_, i) => i !== index));
      if (savedLocations.length <= 1) setIsComparisonOpen(false);
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('export-content');
    if (!element) return;

    try {
        const canvas = await html2canvas(element, {
            backgroundColor: '#0f172a',
            scale: 2
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`geohealth-report-${Date.now()}.pdf`);
    } catch (error) {
        console.error("Failed to export PDF", error);
    }
  };

  return (
    <main className="relative w-full h-screen overflow-hidden bg-slate-50">
      <Map
        onLocationSelect={handleLocationSelect}
        apiResult={apiResult}
        isMapLoaded={isMapLoaded}
        setIsMapLoaded={setIsMapLoaded}
        selectedCoords={selectedCoords}
      />

      <Sidebar
        apiResult={apiResult}
        loading={loading}
        onSaveLocation={handleSaveLocation}
        onExportPDF={handleExportPDF}
        onLocationSubmit={handleLocationSelect}
      />

      {/* Map Legend */}
      <div className="absolute bottom-6 right-12 z-10 bg-white/90 backdrop-blur-md p-3 rounded-xl max-w-[200px] text-xs shadow-lg border border-slate-200">
          <h4 className="font-semibold text-slate-900 mb-2 uppercase border-b border-slate-200 pb-1">SMOD Legend</h4>
          <ul className="space-y-1 text-slate-600">
              <li><span className="inline-block w-3 h-3 rounded-full bg-primary-indigo mr-2"></span>30 - Urban Centre</li>
              <li><span className="inline-block w-3 h-3 rounded-full bg-primary-indigo/70 mr-2"></span>21-23 - Urban Cluster</li>
              <li><span className="inline-block w-3 h-3 rounded-full bg-primary-emerald mr-2"></span>11-13 - Rural</li>
              <li><span className="inline-block w-3 h-3 rounded-full bg-slate-500 mr-2"></span>10 - Water / No Data</li>
          </ul>
      </div>

      {/* Comparison Drawer */}
      <AnimatePresence>
          {savedLocations.length > 0 && (
              <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: isComparisonOpen ? 0 : "calc(100% - 48px)" }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl z-20 bg-white/95 backdrop-blur-md rounded-t-2xl border-t border-x border-slate-200 flex flex-col shadow-xl"
              >
                  {/* Handle */}
                  <div
                      className="h-12 w-full flex items-center justify-between px-6 cursor-pointer hover:bg-slate-50 transition-colors rounded-t-2xl border-b border-slate-200"
                      onClick={() => setIsComparisonOpen(!isComparisonOpen)}
                  >
                      <span className="font-semibold text-slate-900 text-sm">Compare Locations ({savedLocations.length}/3)</span>
                      {isComparisonOpen ? <Minimize2 className="w-4 h-4 text-slate-500" /> : <Maximize2 className="w-4 h-4 text-slate-500" />}
                  </div>

                  {/* Content */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto max-h-[40vh] hide-scrollbar">
                      {savedLocations.map((loc, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-xl relative border border-slate-200 shadow-sm">
                              <button
                                  onClick={() => handleRemoveSavedLocation(idx)}
                                  className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                              <h4 className="text-sm font-bold text-slate-900 mb-1 line-clamp-1 pr-6">{loc.address}</h4>
                              <div className="text-xs text-slate-500 mb-3 space-y-1">
                                  <p className="flex justify-between"><span>SMOD:</span> <span className="text-slate-900 capitalize">{loc.classify?.location_type || 'N/A'}</span></p>
                                  <p className="flex justify-between"><span>Status:</span> <span className={cn("capitalize font-semibold",
                                      loc.accessibility?.status === 'underserved' ? 'text-status-danger' :
                                      loc.accessibility?.status === 'served' || loc.accessibility?.status === 'overserved' ? 'text-status-success' : 'text-slate-500'
                                  )}>{loc.accessibility?.status || 'N/A'}</span></p>
                                  <p className="flex justify-between"><span>Score:</span> <span className="text-slate-900">{loc.accessibility?.accessibility_score?.toFixed(4) || 'N/A'}</span></p>
                              </div>
                          </div>
                      ))}
                  </div>
              </motion.div>
          )}
      </AnimatePresence>
    </main>
  );
}
