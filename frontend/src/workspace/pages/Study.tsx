import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { useWorkspace } from '../store';
import { navigate } from '../../lib/router';
import { platt, priorityScore } from '../../lib/engine';
import { apiService, getSettings, scanImageUrl, type DiagnosticResult, type Report } from '../../services/api';
import { ScanViewer } from '../../components/ScanViewer';
import { PrintableReport, ReportPanel } from '../../components/ReportPanel';
import { Empty, Kbd, ModalityTag, SEV_COLOR, SevPill, StatusPill, fmtDateTime, relTime } from '../../components/ui';

type Tab = 'findings' | 'report' | 'audit';

export const Study: React.FC<{ id: string }> = ({ id }) => {
  const { cases, metaFor, setStatus, audit, upsertCase, toast } = useWorkspace();
  const [c, setC] = useState<DiagnosticResult | null>(cases.find(x => x.case_id === id) ?? null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>('findings');
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const local = cases.find(x => x.case_id === id);
    if (local) { setC(local); return; }
    apiService.getCase(id).then(setC).catch(() => setMissing(true));
  }, [id, cases]);

  // Opening an unread study moves it into review.
  useEffect(() => {
    if (!c) return;
    if (metaFor(c.case_id).status === 'unread') {
      setStatus(c.case_id, 'in_review');
      audit(c.case_id, 'Study opened');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.case_id]);

  const order = useMemo(() =>
    [...cases].sort((a, b) => {
      const sa = metaFor(a.case_id).status === 'signed' ? 1 : 0, sb = metaFor(b.case_id).status === 'signed' ? 1 : 0;
      return sa - sb || priorityScore(b) - priorityScore(a);
    }).map(x => x.case_id),
  [cases, metaFor]);
  const idx = order.indexOf(id);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '[' && prev) navigate(`/app/case/${prev}`);
      if (e.key === ']' && next) navigate(`/app/case/${next}`);
      if (e.key === '1') setTab('findings');
      if (e.key === '2') setTab('report');
      if (e.key === '3') setTab('audit');
      if (e.key === 'Escape') navigate('/app/worklist');
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [prev, next]);

  if (missing) return <div className="p-10"><Empty title="Study not found.">It may have been removed. <a className="underline" href="#/app/worklist">Back to worklist</a></Empty></div>;
  if (!c) return <div className="p-10 font-mono text-[12px] text-g-500">Loading study…</div>;

  const meta = metaFor(c.case_id);
  const img = scanImageUrl(c);

  const save = async (r: Report, note: string) => {
    const updated = await apiService.updateReport(c.case_id, r, note);
    upsertCase(updated); setC(updated);
    toast('New report version saved');
  };
  const sign = () => {
    const reviewer = getSettings().reviewer;
    setStatus(c.case_id, 'signed', { signedBy: reviewer, signedAt: new Date().toISOString() });
    audit(c.case_id, 'Report signed');
    toast(`Signed by ${reviewer}`);
    if (next && metaFor(next).status !== 'signed') setTimeout(() => toast('Press ] for the next study'), 400);
  };
  const unsign = () => {
    setStatus(c.case_id, 'in_review', { signedBy: undefined, signedAt: undefined });
    audit(c.case_id, 'Signature withdrawn');
    toast('Report reopened', 'warn');
  };

  const conf = c.confidence;

  return (
    <>
      <div className="no-print flex h-[calc(100vh)] flex-col max-md:h-auto">
        {/* Header */}
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-g-700 bg-g-900 px-5 py-3">
          <a href="#/app/worklist" className="btn btn-ghost !px-2" title="Back (Esc)"><ArrowLeft className="h-4 w-4" /></a>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[26px] leading-none">{c.metadata.patient_id ?? 'Unknown patient'}</h1>
              <ModalityTag modality={c.modality} />
            </div>
            <p className="mt-1 font-mono text-[10.5px] text-g-500">{c.case_id} · received {fmtDateTime(c.metadata.created_at)} ({relTime(c.metadata.created_at)}){c.metadata.filename ? ` · ${c.metadata.filename}` : ''}</p>
          </div>
          <div className="flex items-center gap-2"><SevPill sev={c.severity} size="md" /><StatusPill status={meta.status} /></div>
          <div className="ml-auto flex items-center gap-1.5">
            <a href={`#/app/case/${c.case_id}/graph`} className="btn"><Share2 className="h-3.5 w-3.5" /> Reasoning graph</a>
            <span className="mx-1 h-5 w-px bg-g-700" />
            <button className="btn btn-ghost !px-2" disabled={!prev} onClick={() => prev && navigate(`/app/case/${prev}`)} title="Previous ( [ )"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-mono text-[11px] tabular-nums text-g-500">{idx + 1}/{order.length}</span>
            <button className="btn btn-ghost !px-2" disabled={!next} onClick={() => next && navigate(`/app/case/${next}`)} title="Next ( ] )"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(380px,1fr)]">
          <ScanViewer
            src={img.src}
            burnedOverlay={img.burnedOverlay}
            findings={c.findings}
            hovered={hovered}
            onHover={setHovered}
            patientId={c.metadata.patient_id ?? ''}
            modality={c.modality}
          />

          <aside className="panel flex min-h-0 flex-col">
            <div className="flex border-b border-g-700">
              {([['findings', `Findings · ${c.findings.length}`], ['report', 'Report'], ['audit', `Audit · ${meta.audit.length}`]] as [Tab, string][]).map(([t, l], i) => (
                <button key={t} onClick={() => setTab(t)} className={`relative flex h-10 items-center gap-2 px-4 text-[12.5px] ${tab === t ? 'text-g-100' : 'text-g-400 hover:text-g-200'}`}>
                  {l} <span className="font-mono text-[10px] text-g-600">{i + 1}</span>
                  {tab === t && <span className="absolute inset-x-3 bottom-[-1px] h-[2px] bg-signal" />}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'findings' && (
                <div>
                  {/* Calibration */}
                  <div className="grid grid-cols-[auto_1fr] items-center gap-5 border-b border-g-700 p-4">
                    <div>
                      <p className="label-mono text-g-500">Reliability</p>
                      <p className="font-display text-[48px] leading-none tabular-nums" style={{ color: conf.prediction_reliability >= 0.85 ? 'var(--color-g-100)' : conf.prediction_reliability >= 0.6 ? 'var(--color-sev-moderate)' : 'var(--color-sev-severe)' }}>
                        {conf.prediction_reliability.toFixed(2)}
                      </p>
                      <p className="mt-1 font-mono text-[10.5px] text-g-400">{conf.confidence_band}</p>
                    </div>
                    <div className="space-y-2">
                      {[['Raw peak score', conf.confidence_score], ['Evidence alignment', conf.evidence_score], ['Model stability', conf.model_stability], ['Platt reliability', conf.prediction_reliability]].map(([k, v]) => (
                        <div key={k as string} className="grid grid-cols-[1fr_120px_36px] items-center gap-3">
                          <span className="text-[12px] text-g-400">{k}</span>
                          <div className="relative h-[3px] bg-g-700"><div className="absolute inset-y-0 left-0 bg-g-200" style={{ width: `${(v as number) * 100}%` }} /></div>
                          <span className="text-right font-mono text-[11px] tabular-nums text-g-200">{(v as number).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {c.findings.length === 0 ? (
                    <Empty title="No focal abnormality detected.">The report records a negative study. Review the image before signing.</Empty>
                  ) : (
                    <ul>
                      {c.findings.map((f, i) => {
                        const ev = c.evidence[i];
                        return (
                          <li
                            key={i}
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered(null)}
                            className={`relative border-b border-g-800 px-4 py-4 transition ${hovered === i ? 'bg-g-850' : ''}`}
                          >
                            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: hovered === i ? SEV_COLOR[f.severity] : 'transparent' }} />
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[14.5px] text-g-100"><span className="mr-2 font-mono text-[11px] text-g-500">{i + 1}</span>{f.name}</p>
                                <p className="mt-0.5 text-[12.5px] text-g-400">{f.location}</p>
                              </div>
                              <SevPill sev={f.severity} />
                            </div>
                            <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-[11px]">
                              <div><p className="text-g-500">raw p</p><p className="text-g-100">{f.probability.toFixed(2)}</p></div>
                              <div><p className="text-g-500">platt</p><p className="text-g-100">{platt(f.probability).toFixed(2)}</p></div>
                              <div><p className="text-g-500">size</p><p className="text-g-100">{ev?.measurement ?? '—'}</p></div>
                              <div><p className="text-g-500">box</p><p className="truncate text-g-100">{f.box ? f.box.map(Math.round).join(',') : '—'}</p></div>
                            </div>
                            <p className="mt-3 text-[12.5px] leading-relaxed text-g-300">{ev?.reason ?? f.evidence}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="p-4">
                    <p className="label-mono mb-2 text-g-500">Graph summary</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.knowledge_graph.nodes.filter(n => n.type !== 'Finding').map(n => (
                        <span key={n.id} className={`rounded-[3px] border px-2 py-0.5 text-[11.5px] ${n.type === 'Disease' ? 'border-g-400 text-g-100' : n.type === 'Severity' ? 'border-g-600 text-g-300' : 'border-g-700 text-g-400'}`}>{n.label}</span>
                      ))}
                    </div>
                    <a href={`#/app/case/${c.case_id}/graph`} className="mt-3 inline-block text-[12px] text-g-300 hover:text-signal">Open full reasoning graph →</a>
                  </div>
                </div>
              )}

              {tab === 'report' && (
                <ReportPanel c={c} meta={meta} onSave={save} onSign={sign} onUnsign={unsign} onExport={k => audit(c.case_id, k === 'print' ? 'Report printed' : 'Report exported', k)} />
              )}

              {tab === 'audit' && (
                <div className="p-4">
                  {meta.versions.length > 0 && (
                    <>
                      <p className="label-mono mb-2 text-g-500">Report versions</p>
                      <ul className="mb-6 overflow-hidden rounded-[4px] border border-g-700">
                        {meta.versions.map((v, i) => (
                          <li key={i} className="flex items-center gap-3 border-b border-g-800 px-3 py-2 text-[12.5px] last:border-0">
                            <span className="font-mono text-[11px] text-g-100">v{meta.versions.length - i + 1}</span>
                            <span className="flex-1 truncate text-g-300">{v.note || <i className="text-g-500">no note</i>}</span>
                            <span className="font-mono text-[11px] text-g-500">{fmtDateTime(v.at)}</span>
                          </li>
                        ))}
                        <li className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                          <span className="font-mono text-[11px] text-g-100">v1</span>
                          <span className="flex-1 text-g-500">Generated by pipeline</span>
                        </li>
                      </ul>
                    </>
                  )}
                  <p className="label-mono mb-2 text-g-500">Event log</p>
                  <ol className="relative border-l border-g-700 pl-5">
                    {meta.audit.map((a, i) => (
                      <li key={i} className="relative pb-4 last:pb-0">
                        <span className={`absolute -left-[24.5px] top-1.5 h-2 w-2 rounded-full border ${i === 0 ? 'border-signal bg-signal' : 'border-g-500 bg-g-900'}`} />
                        <p className="text-[13px] text-g-100">{a.action}</p>
                        <p className="font-mono text-[11px] text-g-500">{a.actor} · {fmtDateTime(a.at)}</p>
                        {a.detail && <p className="mt-0.5 text-[12px] text-g-400">{a.detail}</p>}
                      </li>
                    ))}
                    {meta.audit.length === 0 && <li className="text-[12.5px] text-g-500">No events recorded.</li>}
                  </ol>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-g-700 px-4 py-2 text-[11px] text-g-500">
              <span><Kbd>[</Kbd> <Kbd>]</Kbd> prev/next</span><span><Kbd>O</Kbd> overlay</span><span><Kbd>I</Kbd> invert</span><span><Kbd>M</Kbd> measure</span><span><Kbd>R</Kbd> reset</span>
            </div>
          </aside>
        </div>
      </div>
      <PrintableReport c={c} meta={meta} image={img.src} />
    </>
  );
};
