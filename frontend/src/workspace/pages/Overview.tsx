import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { useWorkspace } from '../store';
import { navigate } from '../../lib/router';
import { priorityScore } from '../../lib/engine';
import { ModalityTag, SEV_COLOR, SEV_ORDER, SectionTitle, SevPill, StatusPill, relTime } from '../../components/ui';

const tip = {
  contentStyle: { background: '#16181b', border: '1px solid #353940', borderRadius: 4, fontSize: 12, fontFamily: 'IBM Plex Mono' },
  labelStyle: { color: '#b3b6bb' },
  itemStyle: { color: '#efede8' },
  cursor: { fill: 'rgba(255,255,255,.04)' },
};

export const Overview: React.FC = () => {
  const { cases, metaFor, mode } = useWorkspace();

  const stats = useMemo(() => {
    const open = cases.filter(c => metaFor(c.case_id).status !== 'signed');
    const urgent = open.filter(c => c.severity === 'Critical' || c.severity === 'Severe');
    const signed = cases.filter(c => metaFor(c.case_id).status === 'signed');
    const withF = cases.filter(c => c.findings.length);
    const meanRel = withF.length ? withF.reduce((s, c) => s + c.confidence.prediction_reliability, 0) / withF.length : 0;
    return { open: open.length, urgent: urgent.length, signed: signed.length, meanRel, total: cases.length };
  }, [cases, metaFor]);

  const sevData = SEV_ORDER.map(s => ({ name: s, value: cases.filter(c => c.severity === s).length }));

  const volume = useMemo(() => {
    const days: { name: string; cr: number; mr: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const inDay = cases.filter(c => { const t = new Date(c.metadata.created_at ?? 0); return t >= d && t < next; });
      days.push({ name: d.toLocaleDateString(undefined, { weekday: 'short' }), cr: inDay.filter(c => c.modality === 'chest_xray').length, mr: inDay.filter(c => c.modality === 'brain_mri').length });
    }
    return days;
  }, [cases]);

  const queue = useMemo(() =>
    cases.filter(c => metaFor(c.case_id).status !== 'signed').map(c => ({ c, p: priorityScore(c) })).sort((a, b) => b.p - a.p).slice(0, 6),
  [cases, metaFor]);

  const activity = useMemo(() =>
    cases.flatMap(c => metaFor(c.case_id).audit.map(a => ({ ...a, c }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8),
  [cases, metaFor]);

  const hour = new Date().getHours();

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-8 md:px-10">
      <SectionTitle
        kicker={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        title={hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.'}
        right={<button className="btn btn-primary" onClick={() => navigate('/app/worklist')}>Start reading <ArrowRight className="h-3.5 w-3.5" /></button>}
      />

      {mode === 'demo' && (
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[4px] border border-dashed border-g-600 px-4 py-2.5 text-[12.5px] text-g-300">
          <span className="label-mono text-sev-moderate">demo engine</span>
          No inference API reachable. Studies are synthetic and run through an in-browser port of the reasoning pipeline.
          <a href="#/app/settings" className="text-g-100 underline decoration-g-500 underline-offset-2 hover:decoration-signal">Connect an API</a>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 overflow-hidden rounded-[6px] border border-g-700 bg-g-700 lg:grid-cols-4" style={{ gap: 1 }}>
        {[
          { k: 'Awaiting read', v: stats.open, s: `${stats.total} studies total` },
          { k: 'Urgent', v: stats.urgent, s: 'critical or severe, unsigned', tone: stats.urgent ? 'var(--color-sev-critical)' : undefined },
          { k: 'Signed', v: stats.signed, s: `${stats.total ? Math.round((stats.signed / stats.total) * 100) : 0}% of studies` },
          { k: 'Mean reliability', v: stats.meanRel.toFixed(2), s: 'Platt-calibrated, studies with findings' },
        ].map(x => (
          <div key={x.k} className="bg-g-900 px-5 py-4">
            <p className="label-mono text-g-400">{x.k}</p>
            <p className="mt-2 font-display text-[44px] leading-none tabular-nums" style={{ color: x.tone }}>{x.v}</p>
            <p className="mt-2 text-[12px] text-g-500">{x.s}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Triage queue */}
        <section className="panel">
          <div className="panel-head">
            <p className="label-mono text-g-300">Triage queue</p>
            <a href="#/app/worklist" className="text-[12px] text-g-400 hover:text-g-100">Full worklist →</a>
          </div>
          {queue.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-g-400">Queue is clear. Every study is signed.</p>
          ) : (
            <ul>
              {queue.map(({ c, p }, i) => (
                <li key={c.case_id}>
                  <button onClick={() => navigate(`/app/case/${c.case_id}`)} className="grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-4 border-b border-g-800 px-4 py-3 text-left last:border-0 hover:bg-g-850">
                    <span className="font-mono text-[11px] text-g-500">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] text-g-100">{c.metadata.patient_id}</span>
                        <ModalityTag modality={c.modality} />
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-g-400">{c.findings.length ? c.findings.map(f => `${f.name} · ${f.location}`).join('; ') : 'No focal findings'}</p>
                    </div>
                    <div className="flex items-center gap-2"><SevPill sev={c.severity} /><StatusPill status={metaFor(c.case_id).status} /></div>
                    <div className="w-14 text-right">
                      <p className="font-mono text-[13px] tabular-nums text-g-100">{p}</p>
                      <p className="font-mono text-[10px] text-g-500">{relTime(c.metadata.created_at)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Severity mix */}
        <section className="panel">
          <div className="panel-head"><p className="label-mono text-g-300">Severity mix</p><span className="font-mono text-[11px] text-g-500">n = {cases.length}</span></div>
          <div className="h-[240px] px-2 pt-4">
            <ResponsiveContainer>
              <BarChart data={sevData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="#26292e" />
                <XAxis type="number" allowDecimals={false} tick={{ fill: '#868b93', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fill: '#b3b6bb', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip {...tip} />
                <Bar dataKey="value" isAnimationActive={false} barSize={14} radius={[0, 2, 2, 0]}>
                  {sevData.map(d => <Cell key={d.name} fill={SEV_COLOR[d.name]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="panel">
          <div className="panel-head">
            <p className="label-mono text-g-300">Volume · last 7 days</p>
            <div className="flex gap-4 font-mono text-[10.5px] text-g-400">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-g-200" /> CR</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-signal" /> MR</span>
            </div>
          </div>
          <div className="h-[220px] px-2 pt-4">
            <ResponsiveContainer>
              <BarChart data={volume} margin={{ left: -18, right: 12 }}>
                <CartesianGrid vertical={false} stroke="#26292e" />
                <XAxis dataKey="name" tick={{ fill: '#868b93', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#868b93', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <Tooltip {...tip} />
                <Bar dataKey="cr" isAnimationActive={false} name="Chest CR" stackId="a" fill="#dcdcd8" barSize={22} />
                <Bar dataKey="mr" isAnimationActive={false} name="Brain MR" stackId="a" fill="#e4572e" barSize={22} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><p className="label-mono text-g-300">Activity</p></div>
          <ul className="px-4 py-2">
            {activity.length === 0 && <li className="py-8 text-center text-[13px] text-g-400">No activity yet.</li>}
            {activity.map((a, i) => (
              <li key={i} className="grid grid-cols-[70px_1fr] gap-3 border-b border-g-800 py-2.5 last:border-0">
                <span className="font-mono text-[11px] text-g-500">{relTime(a.at)}</span>
                <p className="text-[12.5px] text-g-300">
                  <span className="text-g-100">{a.actor}</span> · {a.action.toLowerCase()} ·{' '}
                  <a href={`#/app/case/${a.c.case_id}`} className="text-g-100 underline decoration-g-600 underline-offset-2 hover:decoration-signal">{a.c.metadata.patient_id}</a>
                  {a.detail && <span className="text-g-500"> — {a.detail}</span>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
