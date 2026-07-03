import React from 'react';
import type { Finding } from '../services/api';

interface FindingsTableProps {
  findings: Finding[];
}

export const FindingsTable: React.FC<FindingsTableProps> = ({ findings }) => {
  if (findings.length === 0) {
    return (
      <div className="glass-panel p-6 text-center text-gray-500 text-xs">
        No focal structural abnormalities detected by vision engine.
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5">
        <p className="text-xs font-bold text-gray-500 tracking-wider uppercase">Extracted Scan Findings</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              <th className="px-6 py-3">Finding</th>
              <th className="px-6 py-3">Anatomical Location</th>
              <th className="px-6 py-3">Probability</th>
              <th className="px-6 py-3">Severity</th>
              <th className="px-6 py-3">Evidence pattern</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs text-gray-300">
            {findings.map((f, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition">
                <td className="px-6 py-3.5 font-semibold text-white">{f.name}</td>
                <td className="px-6 py-3.5">{f.location}</td>
                <td className="px-6 py-3.5 font-mono text-cyan-400">{(f.probability * 100).toFixed(0)}%</td>
                <td className="px-6 py-3.5">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    f.severity === 'Severe' || f.severity === 'Critical' ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                    f.severity === 'Moderate' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                    'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  }`}>
                    {f.severity}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-gray-400 italic">{f.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
