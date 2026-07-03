import React, { useState } from 'react';
import { 
  ShieldAlert, 
  User, 
  Sliders
} from 'lucide-react';
import type { DiagnosticResult, Report } from '../services/api';
import { ConfidenceGauge } from '../components/ConfidenceGauge';
import { FindingsTable } from '../components/FindingsTable';
import { ReportEditor } from '../components/ReportEditor';

interface AnalysisProps {
  activeCase: DiagnosticResult;
  onSaveReport: (editedReport: Report, notes: string) => Promise<void>;
}

export const Analysis: React.FC<AnalysisProps> = ({ 
  activeCase, 
  onSaveReport 
}) => {
  const [showOverlay, setShowOverlay] = useState(true);

  // Map case severity to clinical colors
  const getSeverityStyles = (sev: string) => {
    switch (sev) {
      case 'Critical':
        return { bg: 'bg-red-500/10 border-red-500/25', text: 'text-red-400', label: 'CRITICAL ESCALATION' };
      case 'Severe':
        return { bg: 'bg-orange-500/10 border-orange-500/25', text: 'text-orange-400', label: 'SEVERE ALERT' };
      case 'Moderate':
        return { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400', label: 'MODERATE STATUS' };
      case 'Mild':
        return { bg: 'bg-cyan-500/10 border-cyan-500/20', text: 'text-cyan-400', label: 'MILD STATUS' };
      default:
        return { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'MINIMAL SEVERITY' };
    }
  };

  const severityStyle = getSeverityStyles(activeCase.severity);

  return (
    <div className="space-y-8 animate-fade-in py-4">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">Diagnostic Ingestion Details</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-bold tracking-wider text-purple-400 uppercase">
              {activeCase.modality === 'chest_xray' ? 'Chest X-Ray' : 'Brain MRI'}
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-1">Case UUID: {activeCase.case_id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image Scan and metadata (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 tracking-wider uppercase">Scan Visualizer</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOverlay(!showOverlay)}
                  className={`px-3 py-1 rounded text-xs font-semibold border transition ${
                    showOverlay 
                      ? 'bg-purple-600/20 border-purple-500/40 text-purple-300' 
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  Overlay Highlights
                </button>
              </div>
            </div>

            {/* Scan Image Panel */}
            <div className="relative aspect-square rounded-xl overflow-hidden border border-white/5 bg-[#070b13] flex items-center justify-center p-2 group">
              <img
                src={`http://localhost:8000/api/v1/overlay/${activeCase.case_id}`}
                alt="Medical scan overlay"
                className={`w-full h-full object-contain rounded-lg transition-all duration-300 ${
                  showOverlay ? 'filter brightness-105 contrast-105' : 'filter grayscale contrast-90 brightness-95'
                }`}
              />
              {!showOverlay && (
                <div className="absolute top-4 right-4 px-2 py-1 rounded bg-black/60 backdrop-blur border border-white/10 text-[9px] uppercase font-bold tracking-wider text-gray-400">
                  Raw projection
                </div>
              )}
            </div>

            {/* Metadata tags */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 text-xs">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-cyan-400" />
                <div>
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wide">Patient ID</p>
                  <p className="text-white font-medium">{activeCase.metadata.patient_id || 'Unknown'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Sliders className="h-4 w-4 text-purple-400" />
                <div>
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wide">Dimensions</p>
                  <p className="text-white font-medium">
                    {activeCase.metadata.original_width}x{activeCase.metadata.original_height}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Widgets, tables, and reports (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Top widget row: Severity and Calibration Gauge */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Severity Card */}
            <div className={`glass-panel border p-6 flex flex-col justify-between min-h-[220px] ${severityStyle.bg}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 tracking-wider uppercase">Case Severity</p>
                <ShieldAlert className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className={`text-3xl font-extrabold font-heading tracking-tight ${severityStyle.text}`}>
                  {activeCase.severity}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mt-1">
                  {severityStyle.label}
                </p>
              </div>
              <p className="text-xs text-gray-400/90 leading-relaxed border-t border-white/5 pt-3">
                Clinical classification resolved strictly from structured model bounding contours.
              </p>
            </div>

            {/* Recharts Gauge widget */}
            <ConfidenceGauge 
              score={activeCase.confidence.confidence_score} 
              band={activeCase.confidence.confidence_band} 
            />
          </div>

          {/* Detections grid table */}
          <FindingsTable findings={activeCase.findings} />

          {/* Clinician report editor drawer */}
          <ReportEditor 
            report={activeCase.report} 
            onSaveReport={onSaveReport} 
            caseId={activeCase.case_id} 
          />
        </div>
      </div>
    </div>
  );
};
