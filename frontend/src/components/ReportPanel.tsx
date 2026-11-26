import React, { useEffect, useState } from 'react';
import { Check, Download, PenLine, Printer, Lock, Unlock } from 'lucide-react';
import type { CaseMeta, DiagnosticResult, Report } from '../services/api';
import { getSettings } from '../services/api';
import { fmtDateTime } from './ui';

interface Props {
  c: DiagnosticResult;
  meta: CaseMeta;
  onSave: (r: Report, note: string) => Promise<void>;
  onSign: () => void;
  onUnsign: () => void;
  onExport: (kind: string) => void;
}

const FIELDS: { key: keyof Report; label: string; rows: number }[] = [
  { key: 'patient_summary', label: 'Clinical summary', rows: 2 },
  { key: 'imaging_findings', label: 'Findings', rows: 3 },
  { key: 'clinical_interpretation', label: 'Impression & reasoning', rows: 7 },
];

export function reportText(c: DiagnosticResult, meta: CaseMeta): string {
  const r = c.report;
  return `MEDGRAPH AI — DIAGNOSTIC REPORT
Case ${c.case_id}
Patient ${c.metadata.patient_id ?? 'Unknown'} · ${c.modality === 'chest_xray' ? 'Chest radiograph' : 'Brain MRI'}
Status: ${meta.status === 'signed' ? `SIGNED by ${meta.signedBy} at ${fmtDateTime(meta.signedAt)}` : 'DRAFT — PHYSICIAN REVIEW REQUIRED'}

CLINICAL SUMMARY
${r.patient_summary}

FINDINGS
${r.imaging_findings}

EVIDENCE
${r.evidence_summary}
${c.evidence.map((e, i) => `  ${i + 1}. ${e.reason} Size ${e.measurement}. p=${e.confidence.toFixed(2)}`).join('\n')}

IMPRESSION & REASONING
${r.clinical_interpretation}

SEVERITY: ${r.severity_level.toUpperCase()}
CONFIDENCE: ${c.confidence.confidence_band} (reliability ${c.confidence.prediction_reliability})

RECOMMENDATIONS
${r.recommendations.map((x, i) => `  ${i + 1}. ${x}`).join('\n')}

LIMITATIONS
${r.limitations}
`;
}

export const ReportPanel: React.FC<Props> = ({ c, meta, onSave, onSign, onUnsign, onExport }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Report>(c.report);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const signed = meta.status === 'signed';

  useEffect(() => { setDraft(c.report); setEditing(false); }, [c.case_id, c.report]);

  const save = async () => {
    setSaving(true);
    try { await onSave(draft, note); setEditing(false); setNote(''); } finally { setSaving(false); }
  };

  const download = () => {
    const blob = new Blob([reportText(c, meta)], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `MedGraph_${c.metadata.patient_id ?? 'case'}_${c.case_id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    onExport('txt');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-g-700 px-4 py-2.5">
        {signed ? (
          <span className="flex items-center gap-1.5 text-[12.5px] text-sev-minimal"><Lock className="h-3.5 w-3.5" /> Signed by {meta.signedBy} · {fmtDateTime(meta.signedAt)}</span>
        ) : (
          <span className="label-mono text-sev-moderate">Draft · v{meta.versions.length + 1}</span>
        )}
        <div className="ml-auto flex gap-1.5">
          {editing ? (
            <>
              <button className="btn btn-ghost" onClick={() => { setDraft(c.report); setEditing(false); }}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}><Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save version'}</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" title="Download .txt" onClick={download}><Download className="h-3.5 w-3.5" /></button>
              <button className="btn btn-ghost" title="Print / PDF" onClick={() => { onExport('print'); setTimeout(() => window.print(), 50); }}><Printer className="h-3.5 w-3.5" /></button>
              <button className="btn" onClick={() => setEditing(true)}><PenLine className="h-3.5 w-3.5" /> Edit</button>
              {signed
                ? <button className="btn" onClick={onUnsign}><Unlock className="h-3.5 w-3.5" /> Reopen</button>
                : <button className="btn btn-primary" onClick={onSign}><Check className="h-3.5 w-3.5" /> Sign as {getSettings().reviewer.split(' ').slice(-1)[0]}</button>}
            </>
          )}
        </div>
      </div>

      <div className="space-y-5 p-4">
        {signed && editing && (
          <p className="rounded-[4px] border border-sev-moderate/30 bg-sev-moderate/10 px-3 py-2 text-[12px] text-sev-moderate">Saving an edit will reopen this signed report and require a new signature.</p>
        )}
        {FIELDS.map(f => (
          <div key={f.key}>
            <p className="label-mono mb-1.5 text-g-500">{f.label}</p>
            {editing ? (
              <textarea className="field text-[13px]" rows={f.rows} value={draft[f.key] as string} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} />
            ) : (
              <p className="text-[13.5px] leading-[1.65] text-g-200">{c.report[f.key] as string}</p>
            )}
          </div>
        ))}
        <div>
          <p className="label-mono mb-1.5 text-g-500">Recommendations</p>
          <ol className="space-y-1.5">
            {c.report.recommendations.map((r, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] text-g-200"><span className="font-mono text-[11px] leading-[22px] text-g-500">{String(i + 1).padStart(2, '0')}</span>{r}</li>
            ))}
          </ol>
        </div>
        <p className="border-t border-g-800 pt-4 text-[12px] leading-relaxed text-g-500">{c.report.limitations}</p>
        {editing && (
          <label className="block border-t border-g-800 pt-4">
            <span className="label-mono text-signal">Revision note (logged)</span>
            <input className="field mt-1.5" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Narrowed differential after comparing with prior" />
          </label>
        )}
      </div>
    </div>
  );
};

/** Formatted copy that only appears when printing. */
export const PrintableReport: React.FC<{ c: DiagnosticResult; meta: CaseMeta; image: string }> = ({ c, meta, image }) => (
  <div className="print-only" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#000', padding: 24 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 8 }}>
      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 30 }}>MedGraph — Diagnostic Report</div>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, textAlign: 'right' }}>
        {c.case_id}<br />{new Date().toLocaleString()}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
      <img src={image} style={{ width: 220, height: 220, background: '#000' }} />
      <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
        <tbody>
          {[
            ['Patient', c.metadata.patient_id], ['Modality', c.modality === 'chest_xray' ? 'Chest radiograph' : 'Brain MRI'],
            ['Severity', c.severity], ['Confidence', `${c.confidence.confidence_band} (${c.confidence.prediction_reliability})`],
            ['Status', meta.status === 'signed' ? `Signed — ${meta.signedBy}, ${fmtDateTime(meta.signedAt)}` : 'DRAFT — physician review required'],
          ].map(([k, v]) => <tr key={k}><td style={{ padding: '3px 12px 3px 0', color: '#555' }}>{k}</td><td>{v}</td></tr>)}
        </tbody>
      </table>
    </div>
    {[['Clinical summary', c.report.patient_summary], ['Findings', c.report.imaging_findings], ['Impression & reasoning', c.report.clinical_interpretation]].map(([h, t]) => (
      <div key={h} style={{ marginTop: 16 }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#555' }}>{h}</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, margin: '4px 0 0' }}>{t}</p>
      </div>
    ))}
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#555' }}>Recommendations</div>
      <ol style={{ fontSize: 12.5, margin: '4px 0 0', paddingLeft: 18 }}>{c.report.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>
    </div>
    <p style={{ fontSize: 10, color: '#555', marginTop: 24, borderTop: '1px solid #aaa', paddingTop: 8 }}>{c.report.limitations}</p>
    <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span>Signature: {meta.status === 'signed' ? meta.signedBy : '______________________'}</span>
      <span>Date: {meta.status === 'signed' ? fmtDateTime(meta.signedAt) : '__________'}</span>
    </div>
  </div>
);
