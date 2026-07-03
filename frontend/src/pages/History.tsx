import React, { useState, useMemo } from 'react';
import { 
  History as HistoryIcon,
  Search, 
  GitCompare, 
  ArrowRight
} from 'lucide-react';
import type { DiagnosticResult } from '../services/api';

interface HistoryProps {
  history: DiagnosticResult[];
  onSelectCase: (caseId: string) => void;
}

export const History: React.FC<HistoryProps> = ({ history, onSelectCase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalityFilter, setModalityFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  
  // Scans Comparison state variables
  const [compareMode, setCompareMode] = useState(false);
  const [caseAId, setCaseAId] = useState('');
  const [caseBId, setCaseBId] = useState('');

  // Filter cases based on search parameters
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const patientId = item.metadata.patient_id || '';
      const matchesSearch = patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.case_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesModality = !modalityFilter || item.modality === modalityFilter;
      const matchesSeverity = !severityFilter || item.severity === severityFilter;
      
      return matchesSearch && matchesModality && matchesSeverity;
    });
  }, [history, searchTerm, modalityFilter, severityFilter]);

  // Find selected comparison cases
  const caseA = history.find(c => c.case_id === caseAId);
  const caseB = history.find(c => c.case_id === caseBId);

  return (
    <div className="space-y-6 animate-fade-in py-4">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <HistoryIcon className="h-6 w-6 text-cyan-400" />
          <h2 className="text-2xl font-bold tracking-tight">Case Ingestion History</h2>
        </div>
        <button
          onClick={() => {
            setCompareMode(!compareMode);
            setCaseAId('');
            setCaseBId('');
          }}
          className={`px-4 py-2 rounded-lg font-semibold text-xs transition flex items-center gap-2 border ${
            compareMode 
              ? 'bg-purple-600/20 border-purple-500/40 text-purple-300' 
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          <GitCompare className="h-4 w-4" /> {compareMode ? 'Show List View' : 'Compare Scans'}
        </button>
      </div>

      {!compareMode ? (
        // Standard Ingestions List View with Filters
        <div className="space-y-4">
          {/* Filters controls bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search patient ID or case UUID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            <select
              value={modalityFilter}
              onChange={(e) => setModalityFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="" className="bg-[#0b101f]">All Modalities</option>
              <option value="chest_xray" className="bg-[#0b101f]">Chest X-Ray</option>
              <option value="brain_mri" className="bg-[#0b101f]">Brain MRI</option>
            </select>
            
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="" className="bg-[#0b101f]">All Severities</option>
              <option value="Critical" className="bg-[#0b101f]">Critical</option>
              <option value="Severe" className="bg-[#0b101f]">Severe</option>
              <option value="Moderate" className="bg-[#0b101f]">Moderate</option>
              <option value="Mild" className="bg-[#0b101f]">Mild</option>
              <option value="Minimal" className="bg-[#0b101f]">Minimal</option>
            </select>
          </div>

          {/* Cases grid */}
          <div className="grid grid-cols-1 gap-3.5">
            {filteredHistory.length === 0 ? (
              <div className="p-12 text-center glass-panel text-gray-500 text-xs">
                No cases matching filter queries.
              </div>
            ) : (
              filteredHistory.map((item) => (
                <div
                  key={item.case_id}
                  onClick={() => onSelectCase(item.case_id)}
                  className="p-5 glass-panel glass-panel-hover flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-white">Patient ID: {item.metadata.patient_id || 'N/A'}</span>
                      <span className="text-[10px] text-gray-500 font-mono">({item.case_id.slice(0, 8)})</span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono">
                      Dimensions: {item.metadata.original_width}x{item.metadata.original_height}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-cyan-400 uppercase tracking-wide">
                      {item.modality === 'chest_xray' ? 'Chest X-Ray' : 'Brain MRI'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      item.severity === 'Critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      item.severity === 'Severe' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                      item.severity === 'Moderate' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {item.severity}
                    </span>
                    <ArrowRight className="h-4.5 w-4.5 text-gray-500 group-hover:text-white transition" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        // Side-by-Side Comparison Workspace
        <div className="space-y-6 animate-fade-in">
          {/* Select cases cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Select Baseline Scan (Case A)</label>
              <select
                value={caseAId}
                onChange={(e) => setCaseAId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="" className="bg-[#0b101f]">-- Choose baseline case --</option>
                {history.map(c => (
                  <option key={c.case_id} value={c.case_id} className="bg-[#0b101f]">
                    Patient: {c.metadata.patient_id} ({c.modality === 'chest_xray' ? 'X-Ray' : 'MRI'}) - {c.case_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Select Comparison Scan (Case B)</label>
              <select
                value={caseBId}
                onChange={(e) => setCaseBId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="" className="bg-[#0b101f]">-- Choose comparison case --</option>
                {history.map(c => (
                  <option key={c.case_id} value={c.case_id} className="bg-[#0b101f]">
                    Patient: {c.metadata.patient_id} ({c.modality === 'chest_xray' ? 'X-Ray' : 'MRI'}) - {c.case_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison grids panels */}
          {caseA && caseB ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-6">
              {/* Case A Panel Column */}
              <div className="glass-panel p-6 space-y-4">
                <div className="border-b border-white/5 pb-3">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Baseline Diagnostic (A)</span>
                  <h3 className="text-lg font-bold text-white mt-1">Patient ID: {caseA.metadata.patient_id}</h3>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">UUID: {caseA.case_id}</p>
                </div>
                
                {/* Micro details metadata */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-bold">Severity</span>
                    <p className="text-orange-400 font-bold mt-0.5">{caseA.severity}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-bold">Calibrated Reliability</span>
                    <p className="text-cyan-400 font-mono font-bold mt-0.5">{(caseA.confidence.prediction_reliability * 100).toFixed(0)}%</p>
                  </div>
                </div>

                {/* Findings summary column */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Observations</span>
                  {caseA.findings.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No abnormalities extracted.</p>
                  ) : (
                    caseA.findings.map((f, i) => (
                      <div key={i} className="flex justify-between text-xs border-b border-white/[0.02] pb-1.5">
                        <span className="text-white font-medium">{f.name} ({f.location})</span>
                        <span className="text-cyan-400 font-mono">{(f.probability * 100).toFixed(0)}%</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Recommendations */}
                <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Recommendations</span>
                  <ul className="list-disc pl-4 space-y-1 text-gray-300">
                    {caseA.report.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Case B Panel Column */}
              <div className="glass-panel p-6 space-y-4">
                <div className="border-b border-white/5 pb-3">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Comparison Diagnostic (B)</span>
                  <h3 className="text-lg font-bold text-white mt-1">Patient ID: {caseB.metadata.patient_id}</h3>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">UUID: {caseB.case_id}</p>
                </div>

                {/* Micro details metadata */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-bold">Severity</span>
                    <p className="text-orange-400 font-bold mt-0.5">{caseB.severity}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-bold">Calibrated Reliability</span>
                    <p className="text-cyan-400 font-mono font-bold mt-0.5">{(caseB.confidence.prediction_reliability * 100).toFixed(0)}%</p>
                  </div>
                </div>

                {/* Findings summary column */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Observations</span>
                  {caseB.findings.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No abnormalities extracted.</p>
                  ) : (
                    caseB.findings.map((f, i) => (
                      <div key={i} className="flex justify-between text-xs border-b border-white/[0.02] pb-1.5">
                        <span className="text-white font-medium">{f.name} ({f.location})</span>
                        <span className="text-cyan-400 font-mono">{(f.probability * 100).toFixed(0)}%</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Recommendations */}
                <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Recommendations</span>
                  <ul className="list-disc pl-4 space-y-1 text-gray-300">
                    {caseB.report.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-16 text-center border border-dashed border-white/10 rounded-xl text-gray-500 text-sm">
              Please choose two scans from the dropdown selectors to display comparison metrics.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
