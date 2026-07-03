import React from 'react';
import { 
  Clock,
  ArrowRight
} from 'lucide-react';
import type { DiagnosticResult } from '../services/api';

interface DashboardProps {
  history: DiagnosticResult[];
  onSelectCase: (caseId: string) => void;
  onNavigateToUpload: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  history, 
  onSelectCase, 
  onNavigateToUpload 
}) => {
  // Compute analytics
  const totalCases = history.length;
  const criticalCount = history.filter(c => c.severity === 'Critical').length;
  const severeCount = history.filter(c => c.severity === 'Severe').length;
  
  const avgStability = totalCases > 0 
    ? (history.reduce((sum, c) => sum + c.confidence.model_stability, 0) / totalCases * 100).toFixed(0)
    : '0';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative p-8 rounded-2xl overflow-hidden glass-panel border-purple-500/20 bg-gradient-to-r from-purple-950/20 via-[#0d1426] to-cyan-950/10">
        <div className="relative z-10 space-y-2">
          <h2 className="text-3xl font-extrabold tracking-tight">Clinical Decision Support Command Center</h2>
          <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
            MedGraph AI generates explainable multimodal diagnostics by linking deep learning segmentation outputs 
            with relational clinical evidence knowledge graphs.
          </p>
          <div className="pt-4">
            <button 
              onClick={onNavigateToUpload}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 font-semibold text-sm transition-all duration-200 shadow-lg shadow-purple-500/20 hover:scale-102 flex items-center gap-2 text-white"
            >
              Analyze New Scan <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Analytics grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Scanned Ingestion', value: totalCases, desc: 'Processed scans' },
          { label: 'Critical Escalations', value: criticalCount, desc: 'Immediate priority', color: 'text-red-500' },
          { label: 'Severe Classifications', value: severeCount, desc: 'High alert cases', color: 'text-orange-500' },
          { label: 'Mean Model Stability', value: `${avgStability}%`, desc: 'Average consistency' }
        ].map((card, i) => (
          <div key={i} className="p-6 glass-panel glass-panel-hover flex flex-col justify-between min-h-36">
            <p className="text-xs font-bold text-gray-500 tracking-wider uppercase">{card.label}</p>
            <div>
              <p className={`text-4xl font-extrabold font-heading ${card.color || 'text-white'}`}>{card.value}</p>
              <p className="text-xs text-gray-400 mt-1">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main dashboard content */}
      <div className="grid grid-cols-1 gap-8">
        {/* Recent cases */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold tracking-tight px-1">Recent Ingestions</h3>
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="p-8 text-center glass-panel text-gray-500 text-sm">
                No cases analyzed yet. Ingest a scan to populate.
              </div>
            ) : (
              history.slice(0, 5).map((c) => (
                <div 
                  key={c.case_id}
                  onClick={() => onSelectCase(c.case_id)}
                  className="p-4 glass-panel glass-panel-hover flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      c.severity === 'Critical' ? 'bg-red-500 animate-ping' :
                      c.severity === 'Severe' ? 'bg-orange-500' :
                      c.severity === 'Moderate' ? 'bg-yellow-500' : 'bg-emerald-500'
                    }`} />
                    <div>
                      <p className="text-sm font-semibold text-white">ID: {c.case_id.slice(0, 8)}...</p>
                      <p className="text-xs text-gray-400">Patient: {c.metadata.patient_id || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      {c.modality === 'chest_xray' ? 'Chest X-Ray' : 'Brain MRI'}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Recent
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
