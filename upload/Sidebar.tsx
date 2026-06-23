'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Trees, Home, Navigation, MapPin, Activity, HelpCircle, Save, Download } from 'lucide-react';
import { GeoHealthResult } from '../types/api';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SidebarProps {
  apiResult: GeoHealthResult | null;
  loading: boolean;
  onSaveLocation: () => void;
  onExportPDF: () => void;
  onLocationSubmit: (lat: number, lon: number) => void;
}

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Sidebar({ apiResult, loading, onSaveLocation, onExportPDF, onLocationSubmit }: SidebarProps) {
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');

  const handleCoordinateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    if (!isNaN(lat) && !isNaN(lon)) {
      onLocationSubmit(lat, lon);
    }
  };

  const renderSMODIcon = (type?: string) => {
    switch (type) {
      case 'high-density urban':
      case 'urban':
        return <Building2 className="w-8 h-8 text-primary-indigo" />;
      case 'rural':
        return <Trees className="w-8 h-8 text-primary-emerald" />;
      case 'suburban':
        return <Home className="w-8 h-8 text-secondary-slate" />;
      default:
        return <HelpCircle className="w-8 h-8 text-status-warning" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'overserved':
      case 'served':
        return 'text-status-success';
      case 'underserved':
        return 'text-status-danger';
      default:
        return 'text-status-warning';
    }
  };

  const getStatusBg = (status?: string) => {
    switch (status) {
      case 'overserved':
      case 'served':
        return 'bg-status-success';
      case 'underserved':
        return 'bg-status-danger';
      default:
        return 'bg-status-warning';
    }
  };

  const renderGauge = (score: number | null, status: string | undefined) => {
    const percentage = score !== null ? Math.min(Math.max((score * 100000) / 200 * 100, 0), 100) : 0;

    return (
      <div className="w-full mt-4">
        <div className="flex justify-between text-xs mb-1 text-slate-500">
          <span>0 (Underserved)</span>
          <span>200+ (Overserved)</span>
        </div>
        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full", getStatusBg(status))}
          />
        </div>
        <div className="text-center mt-2 font-mono text-sm">
           Score: {score !== null ? score.toFixed(5) : 'N/A'}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ x: -400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="absolute top-4 left-4 z-10 w-full max-w-sm sm:max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 rounded-2xl flex flex-col hide-scrollbar"
      id="export-content"
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary-indigo" />
            GeoHealth V1
          </h1>
          <p className="text-xs text-slate-500 mt-1">SMOD & Accessibility Classifier</p>
        </div>
        <div className="flex gap-2">
            <button
                onClick={onSaveLocation}
                disabled={!apiResult || loading}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
                title="Save Location to Compare"
            >
                <Save className="w-5 h-5 text-slate-600" />
            </button>
            <button
                onClick={onExportPDF}
                disabled={!apiResult || loading}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
                title="Export Report"
            >
                <Download className="w-5 h-5 text-slate-600" />
            </button>
        </div>
      </div>

      {/* Search Coordinates Form */}
      <form onSubmit={handleCoordinateSubmit} className="p-5 border-b border-glass-border-dark flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-400 font-semibold mb-1 block">Latitude</label>
            <input
              type="number"
              step="any"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              placeholder="e.g. 9.0820"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-indigo transition-colors"
              required
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-400 font-semibold mb-1 block">Longitude</label>
            <input
              type="number"
              step="any"
              value={lonInput}
              onChange={(e) => setLonInput(e.target.value)}
              placeholder="e.g. 8.6753"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-indigo transition-colors"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-primary-indigo hover:bg-indigo-600 text-white font-medium py-2 rounded-lg transition-colors text-sm"
        >
          Search Coordinates
        </button>
      </form>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-10"
            >
              <div className="w-10 h-10 border-4 border-primary-indigo border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-500 animate-pulse">Analyzing Location...</p>
            </motion.div>
          ) : !apiResult ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-10 text-slate-500"
            >
              <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Click anywhere on the map or enter coordinates below to analyze a location in Nigeria.</p>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-5"
            >
              {/* Address / Coordinates */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs uppercase text-slate-500 font-semibold mb-1">Selected Location</h3>
                <p className="font-medium text-slate-900 text-sm line-clamp-2">{apiResult.address}</p>
                <div className="flex gap-4 mt-2 text-xs font-mono text-slate-500">
                  <span>Lat: {apiResult.lat.toFixed(4)}</span>
                  <span>Lon: {apiResult.lon.toFixed(4)}</span>
                </div>
              </div>

              {/* Classification Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    {renderSMODIcon(apiResult.classify?.location_type)}
                </div>
                <h3 className="text-xs uppercase text-slate-500 font-semibold mb-2">SMOD Classification</h3>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl font-bold capitalize text-slate-900">
                    {apiResult.classify?.location_type || 'Unknown'}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {apiResult.classify?.classification_reason || 'No data available'}
                </p>
                <div className="mt-3 inline-block px-2 py-1 rounded bg-slate-100 text-xs font-mono text-slate-500">
                   Code: {apiResult.classify?.smod_code ?? 'N/A'}
                </div>
              </div>

              {/* Accessibility Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs uppercase text-slate-500 font-semibold mb-2">Health Accessibility</h3>
                <div className="flex items-end justify-between">
                  <div>
                    <span className={cn("text-xl font-bold capitalize", getStatusColor(apiResult.accessibility?.status))}>
                      {apiResult.accessibility?.status || 'Unknown'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-slate-600 font-medium">
                      {apiResult.accessibility?.facilities_per_100k?.toFixed(1) || '0'}
                    </span>
                    <span className="text-xs text-slate-500 block">Facilities / 100k</span>
                  </div>
                </div>
                {renderGauge(apiResult.accessibility?.accessibility_score ?? null, apiResult.accessibility?.status)}
              </div>

              {/* Nearest Facility Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs uppercase text-slate-500 font-semibold mb-3 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-slate-400" />
                    Nearest Facility
                </h3>

                {apiResult.nearestFacility ? (
                    <div className="space-y-3">
                        <p className="font-semibold text-slate-900 text-lg leading-tight">
                            {apiResult.nearestFacility.facility_name}
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                <span className="block text-xs text-slate-500 mb-1">Drive Dist.</span>
                                <span className="font-mono text-sm text-primary-emerald font-semibold">
                                    {apiResult.nearestFacility.driving_distance_km ? `${apiResult.nearestFacility.driving_distance_km} km` : 'N/A'}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                <span className="block text-xs text-slate-500 mb-1">Est. Time</span>
                                <span className="font-mono text-sm text-primary-indigo font-semibold">
                                    {apiResult.nearestFacility.travel_time_minutes ? `${apiResult.nearestFacility.travel_time_minutes} min` : 'N/A'}
                                </span>
                            </div>
                        </div>
                        <div className="text-xs text-slate-400 text-center mt-2">
                             Straight line: {apiResult.nearestFacility.straight_line_distance_km} km
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">No facility data available.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
