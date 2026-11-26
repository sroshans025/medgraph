import React, { useMemo, useState } from 'react';
import { Columns2, Search, Download } from 'lucide-react';
import { useWorkspace } from '../store';
import { navigate } from '../../lib/router';
import { scanImageUrl, type DiagnosticResult } from '../../services/api';
import { Empty, ModalityTag, SEV_ORDER, SectionTitle, SevPill, StatusPill, fmtDateTime } from '../../components/ui';

const ComparePane: React.FC<{ c: DiagnosticResult | undefined; side: 'A' | 'B' }> = ({ c, side }) => {
  if (!c) return <div className="panel flex min-h-[420px] items-center justify-center text-[13px] text-g-500">Pick study {side} from the list</div>;
  const img = scanImageUrl(c);
  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">
        <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-signal">{side}</span><span className="text-[13.5px]">{c.metadata.patient_id}</span><ModalityTag modality={c.modality} /></div>
        <SevPill sev={c.severity} />
      </div>
      <div className="relative aspect-square bg-black">
        <img src={img.src} alt="" className="h-full w-full object-contain" />
        {!img.burnedOverlay && (
          <svg viewBox="0 0 512 512" className="absolute inset-0 h-full w-full">
            {c.findings.map((f, i) => f.box && <rect key={i} x={f.box[0]} y={f.box[1]} width={f.box[2] - f.box[0]} height={f.box[3] - f.box[1]} fill="none" stroke="#e4572e" strokeWidth="1.5" />)}
          </svg>
        )}
      </div>
      <div className="grid grid-cols-3 border-t border-g-700 font-mono text-[11px]">
        {[['reliability', c.confidence.prediction_reliability.toFixed(2)], ['findings', c.findings.length], ['stability', c.confidence.model_stability.toFixed(2)]].map(([k, v]) => (
          <div key={k as string} className="border-r border-g-700 px-3 py-2 last:border-0"><p className="text-g-500">{k}</p><p className="text-g-100">{v}</p></div>
        ))}
      </div>
      <ul className="border-t border-g-700">
        {c.findings.map((f, i) => (
          <li key={i} className="flex justify-between border-b border-g-800 px-3 py-2 text-[12.5px] last:border-0"><span>{f.name} · <span className="text-g-400">{f.location}</span></span><span className="font-mono text-g-300">{f.probability.toFixed(2)}</span></li>
        ))}
        {c.findings.length === 0 && <li className="px-3 py-2 text-[12.5px] text-g-500">No focal findings</li>}
      </ul>
    </div>
  );
};

export const ArchivePage: React.FC = () => {
  const { cases, metaFor, toast } = useWorkspace();
  const [q, setQ] = useState('');
  const [sev, setSev] = useState('');
  const [compare, setCompare] = useState(false);
  const [pair, setPair] = useState<[string | null, string | null]>([null, null]);

  const list = useMemo(() => cases.filter(c =>
    (!sev || c.severity === sev) &&
    (!q || `${c.metadata.patient_id} ${c.case_id} ${c.findings.map(f => f.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [cases, q, sev]);

  const pick = (id: string) => {
    if (!compare) return navigate(`/app/case/${id}`);
    setPair(([a, b]) => (a === id ? [b, null] : b === id ? [a, null] : !a ? [id, b] : !b ? [a, id] : [b, id]));
  };

  const exportCsv = () => {
    const rows = [['case_id', 'patient_id', 'modality', 'received', 'severity', 'findings', 'reliability', 'status', 'signed_by']];
    cases.forEach(c => {
      const m = metaFor(c.case_id);
      rows.push([c.case_id, c.metadata.patient_id ?? '', c.modality, c.metadata.created_at ?? '', c.severity, c.findings.map(f => f.name).join('; '), String(c.confidence.prediction_reliability), m.status, m.signedBy ?? '']);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `medgraph_archive_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast(`Exported ${cases.length} studies`);
  };

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-8 md:px-10">
      <SectionTitle
        kicker="All studies"
        title="Archive"
        right={
          <div className="flex gap-2">
            <button className="btn" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</button>
            <button className={`btn ${compare ? 'btn-primary' : ''}`} onClick={() => { setCompare(v => !v); setPair([null, null]); }}><Columns2 className="h-3.5 w-3.5" /> {compare ? 'Exit compare' : 'Compare'}</button>
          </div>
        }
      />

      {compare && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <ComparePane side="A" c={cases.find(c => c.case_id === pair[0])} />
          <ComparePane side="B" c={cases.find(c => c.case_id === pair[1])} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-g-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="field !h-8 pl-8 text-[12.5px]" />
        </div>
        <select value={sev} onChange={e => setSev(e.target.value)} className="field !h-8 !w-auto text-[12.5px]">
          <option value="">All severities</option>
          {SEV_ORDER.map(s => <option key={s}>{s}</option>)}
        </select>
        {compare && <p className="self-center text-[12px] text-g-400">Click two rows to place them side by side.</p>}
      </div>

      {list.length === 0 ? <div className="panel"><Empty title="No studies match." /></div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map(c => {
            const img = scanImageUrl(c);
            const slot = pair[0] === c.case_id ? 'A' : pair[1] === c.case_id ? 'B' : null;
            return (
              <button key={c.case_id} onClick={() => pick(c.case_id)} className={`panel group overflow-hidden text-left transition hover:border-g-500 ${slot ? '!border-signal' : ''}`}>
                <div className="relative aspect-[4/3] overflow-hidden bg-black">
                  <img src={img.src} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:scale-[1.03] group-hover:opacity-100" />
                  {slot && <span className="absolute left-2 top-2 rounded-[2px] bg-signal px-1.5 font-mono text-[11px] text-white">{slot}</span>}
                  <span className="absolute right-2 top-2"><SevPill sev={c.severity} /></span>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between"><span className="text-[13.5px]">{c.metadata.patient_id}</span><StatusPill status={metaFor(c.case_id).status} /></div>
                  <div className="mt-1 flex items-center justify-between"><ModalityTag modality={c.modality} /><span className="font-mono text-[10.5px] text-g-500">{fmtDateTime(c.metadata.created_at)}</span></div>
                  <p className="mt-2 truncate text-[12px] text-g-400">{c.findings.map(f => f.name).join(', ') || 'No focal findings'}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
