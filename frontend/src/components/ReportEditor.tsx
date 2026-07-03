import React, { useState } from 'react';
import { 
  FileText, 
  Edit3, 
  Check, 
  X, 
  Download,
  AlertTriangle 
} from 'lucide-react';
import type { Report } from '../services/api';

interface ReportEditorProps {
  report: Report;
  onSaveReport: (editedReport: Report, notes: string) => Promise<void>;
  caseId: string;
}

export const ReportEditor: React.FC<ReportEditorProps> = ({ 
  report, 
  onSaveReport, 
  caseId 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [patientSummary, setPatientSummary] = useState(report.patient_summary);
  const [imagingFindings, setImagingFindings] = useState(report.imaging_findings);
  const [clinicalInterpretation, setClinicalInterpretation] = useState(report.clinical_interpretation);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: Report = {
        ...report,
        patient_summary: patientSummary,
        imaging_findings: imagingFindings,
        clinical_interpretation: clinicalInterpretation,
      };
      await onSaveReport(updated, doctorNotes);
      setIsEditing(false);
      setDoctorNotes('');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPatientSummary(report.patient_summary);
    setImagingFindings(report.imaging_findings);
    setClinicalInterpretation(report.clinical_interpretation);
    setDoctorNotes('');
    setIsEditing(false);
  };

  const handleDownload = () => {
    const reportText = `
======================================================
MEDGRAPH AI CLINICAL REPORT - CASE ID: ${caseId}
======================================================
[PHYSICIAN REVIEW REQUIRED - DRAFT ONLY]

PATIENT SUMMARY:
${report.patient_summary}

IMAGING FINDINGS:
${report.imaging_findings}

EVIDENCE STRUCTURE SUMMARY:
${report.evidence_summary}

CLINICAL INTERPRETATION & REASONING PATHWAY:
${report.clinical_interpretation}

CASE SEVERITY GRADIENT:
${report.severity_level.toUpperCase()}

RECOMMENDED CLINICAL ACTIONS:
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

LIMITATIONS OF ANALYSIS:
${report.limitations}

------------------------------------------------------
Physician Signature: _______________________________ Date: _________
`;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MedGraph_Report_${caseId.slice(0, 8)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Clinical Report Draft</h3>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs transition flex items-center gap-1.5 text-white"
              >
                <Check className="h-3.5 w-3.5" /> Save
              </button>
              <button 
                onClick={handleCancel}
                className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 font-semibold text-xs transition flex items-center gap-1.5 text-gray-300"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 font-semibold text-xs transition flex items-center gap-1.5 text-purple-300"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit Draft
              </button>
              <button 
                onClick={handleDownload}
                className="px-3 py-1.5 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 font-semibold text-xs transition flex items-center gap-1.5 text-cyan-300"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </>
          )}
        </div>
      </div>

      {/* Safety Banner */}
      <div className="p-3.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-start gap-3 text-orange-400 text-xs leading-relaxed">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider block mb-0.5">Physician Review Required</span>
          This is an AI-generated clinical assistance draft. Every statement is grounded in extracted vision elements. Attending physician signature is required to finalize diagnosis.
        </div>
      </div>

      {/* Report sections */}
      <div className="space-y-4 text-sm">
        {/* Patient Summary */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Patient summary</label>
          {isEditing ? (
            <textarea
              value={patientSummary}
              onChange={(e) => setPatientSummary(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded bg-[#070b13] border border-white/10 text-white focus:outline-none focus:border-purple-500"
              rows={2}
            />
          ) : (
            <p className="text-gray-300 bg-white/[0.01] p-3 rounded border border-white/[0.03] text-xs leading-relaxed">{report.patient_summary}</p>
          )}
        </div>

        {/* Imaging Findings */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Imaging findings</label>
          {isEditing ? (
            <textarea
              value={imagingFindings}
              onChange={(e) => setImagingFindings(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded bg-[#070b13] border border-white/10 text-white focus:outline-none focus:border-purple-500"
              rows={3}
            />
          ) : (
            <p className="text-gray-300 bg-white/[0.01] p-3 rounded border border-white/[0.03] text-xs leading-relaxed">{report.imaging_findings}</p>
          )}
        </div>

        {/* Clinical Reasoning */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Clinical Interpretation & reasoning</label>
          {isEditing ? (
            <textarea
              value={clinicalInterpretation}
              onChange={(e) => setClinicalInterpretation(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded bg-[#070b13] border border-white/10 text-white focus:outline-none focus:border-purple-500"
              rows={5}
            />
          ) : (
            <p className="text-gray-300 bg-white/[0.01] p-3 rounded border border-white/[0.03] text-xs leading-relaxed">{report.clinical_interpretation}</p>
          )}
        </div>

        {/* Recommendations list */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Follow-up Recommendations</label>
          <ul className="list-disc pl-5 space-y-1 text-xs text-gray-300">
            {report.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {/* Limitations */}
        <div className="text-[10px] text-gray-500 italic mt-4 pt-4 border-t border-white/5">
          {report.limitations}
        </div>

        {/* Edit Audit notes */}
        {isEditing && (
          <div className="space-y-1.5 pt-4 border-t border-white/5 animate-fade-in">
            <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wide">Revision Log / Audit Notes</label>
            <input
              type="text"
              placeholder="e.g. Corrected consolidation margins..."
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded bg-[#070b13] border border-purple-500/20 text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};
