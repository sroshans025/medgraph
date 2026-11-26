import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Search } from 'lucide-react';
import { useWorkspace } from '../store';
import { navigate } from '../../lib/router';
import { priorityScore } from '../../lib/engine';
import { Empty, Kbd, Meter, ModalityTag, SEV_ORDER, SectionTitle, SevPill, StatusPill, relTime } from '../../components/ui';
import type { ReviewStatus } from '../../services/api';

type SortKey = 'priority' | 'time' | 'severity' | 'confidence';

export const Worklist: React.FC = () => {
  const { cases, metaFor } = useWorkspace();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'open' | ReviewStatus | 'all'>('open');
  const [mod, setMod] = useState<'all' | 'chest_xray' | 'brain_mri'>('all');
  const [sort, setSort] = useState<SortKey>('priority');
  const [dir, setDir] = useState<1 | -1>(-1);
  const [cursor, setCursor] = useState(0);

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    const list = cases
      .map(c => ({ c, m: metaFor(c.case_id), p: priorityScore(c) }))
      .filter(({ c, m }) =>
        (status === 'all' || (status === 'open' ? m.status !== 'signed' : m.status === status)) &&
        (mod === 'all' || c.modality === mod) &&
        (!ql || `${c.metadata.patient_id} ${c.case_id} ${c.findings.map(f => f.name + ' ' + f.location).join(' ')}`.toLowerCase().includes(ql)));
    const val = (r: typeof list[number]) =>
      sort === 'priority' ? r.p : sort === 'time' ? new Date(r.c.metadata.created_at ?? 0).getTime()
        : sort === 'severity' ? -SEV_ORDER.indexOf(r.c.severity) : r.c.confidence.prediction_reliability;
    return list.sort((a, b) => (val(a) - val(b)) * dir);
  }, [cases, metaFor, q, status, mod, sort, dir]);

  useEffect(() => setCursor(0), [q, status, mod, sort, dir]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(rows.length - 1, c + 1)); }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
      if (e.key === 'Enter' && rows[cursor]) navigate(`/app/case/${rows[cursor].c.case_id}`);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [rows, cursor]);

  const th = (k: SortKey, label: string, cls = '') => (
    <th className={`px-3 py-2 font-normal ${cls}`}>
      <button onClick={() => (sort === k ? setDir(d => (d === 1 ? -1 : 1)) : (setSort(k), setDir(-1)))} className={`label-mono inline-flex items-center gap-1 ${sort === k ? 'text-g-100' : 'text-g-500 hover:text-g-300'}`}>
        {label}{sort === k && (dir === -1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </th>
  );

  const counts = {
    open: cases.filter(c => metaFor(c.case_id).status !== 'signed').length,
    unread: cases.filter(c => metaFor(c.case_id).status === 'unread').length,
    in_review: cases.filter(c => metaFor(c.case_id).status === 'in_review').length,
    signed: cases.filter(c => metaFor(c.case_id).status === 'signed').length,
    all: cases.length,
  };

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-8 md:px-10">
      <SectionTitle kicker="Reading queue" title="Worklist" right={<button className="btn btn-primary" onClick={() => navigate('/app/new')}><Plus className="h-3.5 w-3.5" /> New study</button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-[4px] border border-g-700">
          {(['open', 'unread', 'in_review', 'signed', 'all'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)} className={`h-8 border-r border-g-700 px-3 text-[12.5px] last:border-0 ${status === s ? 'bg-g-700 text-g-100' : 'bg-g-900 text-g-400 hover:text-g-100'}`}>
              {s === 'in_review' ? 'In review' : s[0].toUpperCase() + s.slice(1)} <span className="ml-1 font-mono text-[11px] text-g-500">{counts[s]}</span>
            </button>
          ))}
        </div>
        <select value={mod} onChange={e => setMod(e.target.value as typeof mod)} className="field !h-8 !w-auto text-[12.5px]">
          <option value="all">All modalities</option>
          <option value="chest_xray">Chest CR</option>
          <option value="brain_mri">Brain MR</option>
        </select>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-g-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Patient, finding, region…" className="field !h-8 pl-8 text-[12.5px]" />
        </div>
      </div>

      <div className="panel overflow-x-auto">
        {rows.length === 0 ? (
          <Empty title="Nothing matches these filters.">Try “All” or clear the search.</Empty>
        ) : (
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-g-700 bg-g-850">
              <tr>
                {th('priority', 'Pri', 'w-16')}
                <th className="label-mono px-3 py-2 font-normal text-g-500">Patient</th>
                <th className="label-mono px-3 py-2 font-normal text-g-500">Findings</th>
                {th('severity', 'Severity')}
                {th('confidence', 'Reliability')}
                <th className="label-mono px-3 py-2 font-normal text-g-500">Status</th>
                {th('time', 'Received', 'text-right')}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, m, p }, i) => (
                <tr
                  key={c.case_id}
                  onClick={() => navigate(`/app/case/${c.case_id}`)}
                  onMouseEnter={() => setCursor(i)}
                  className={`cursor-pointer border-b border-g-800 last:border-0 ${i === cursor ? 'bg-g-850' : ''}`}
                >
                  <td className="relative px-3 py-3 font-mono text-[13px] tabular-nums text-g-100">
                    {i === cursor && <span className="absolute inset-y-0 left-0 w-[2px] bg-signal" />}
                    {p}
                  </td>
                  <td className="px-3 py-3">
                    <p className={`text-[13.5px] ${m.status === 'unread' ? 'font-medium text-g-100' : 'text-g-200'}`}>{c.metadata.patient_id}</p>
                    <ModalityTag modality={c.modality} />
                  </td>
                  <td className="max-w-[320px] px-3 py-3">
                    <p className="truncate text-[12.5px] text-g-300">{c.findings.length ? c.findings.map(f => `${f.name} (${f.location})`).join(', ') : <span className="text-g-500">No focal findings</span>}</p>
                  </td>
                  <td className="px-3 py-3"><SevPill sev={c.severity} /></td>
                  <td className="px-3 py-3"><Meter value={c.confidence.prediction_reliability} /></td>
                  <td className="px-3 py-3"><StatusPill status={m.status} /></td>
                  <td className="px-3 py-3 text-right font-mono text-[11.5px] text-g-400">{relTime(c.metadata.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 flex items-center gap-2 text-[11.5px] text-g-500">
        <Kbd>j</Kbd><Kbd>k</Kbd> move · <Kbd>↵</Kbd> open · priority = severity weight + 15 × confidence + 0.4 × hours waiting (capped at 48h)
      </p>
    </div>
  );
};
