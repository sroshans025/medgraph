import React, { useEffect, useMemo, useState } from 'react';
import { buildGraph, platt } from '../lib/engine';
import type { Finding } from '../services/api';

/* ─────────────── Pipeline walkthrough ─────────────── */

const STAGES = [
  {
    n: '01', name: 'Preprocess', time: '38 ms',
    body: 'DICOM, NIfTI, PNG and JPEG are decoded, windowed and resampled to a 512 × 512 grid. Identifying header tags are dropped before anything else touches the pixels.',
    out: `{
  "original_width": 2048,
  "original_height": 2500,
  "resampled": [512, 512],
  "phi_tags_removed": 14
}`,
  },
  {
    n: '02', name: 'Modality', time: '4 ms',
    body: 'A lightweight detector looks at intensity histogram and aspect ratio to route the study: chest radiograph or brain MRI. A clinician can override it at upload.',
    out: `{
  "modality": "chest_xray",
  "score": 0.97,
  "override": null
}`,
  },
  {
    n: '03', name: 'Vision', time: '412 ms',
    body: 'Chest films go to a YOLOv11 detector; MRI slices go to a MONAI U-Net for segmentation plus a classifier for tumour type. Every finding keeps its box.',
    out: `[{
  "name": "Opacity",
  "location": "Right Lower Lobe",
  "probability": 0.91,
  "box": [148, 318, 222, 384]
}]`,
  },
  {
    n: '04', name: 'Calibrate', time: '1 ms',
    body: 'Raw probabilities are Platt-scaled into a reliability score and banded. Stability is measured from the spread across findings, not assumed.',
    out: `{
  "confidence_score": 0.91,
  "prediction_reliability": 0.96,
  "confidence_band": "High Confidence",
  "model_stability": 0.95
}`,
  },
  {
    n: '05', name: 'Graph', time: '3 ms',
    body: 'Findings become nodes in a directed clinical graph: what was seen, what it suggests, how severe, and what to do next. Each edge is a rule you can read.',
    out: `finding_0 ─SUGGESTS→ disease_pneumonia
disease_pneumonia ─HAS_SEVERITY→ severity_severe
disease_pneumonia ─REQUIRES→ rec_ct
disease_pneumonia ─REQUIRES→ rec_hospital`,
  },
  {
    n: '06', name: 'Report', time: '2 ms',
    body: 'The draft is assembled from templates filled only with values produced upstream. No free-text generation, so nothing appears in the report that the models did not output.',
    out: `IMAGING FINDINGS
A severe opacity is visualized in
the right lower lobe.

STATUS: PHYSICIAN REVIEW REQUIRED`,
  },
];

export const PipelineSection: React.FC = () => {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setI(v => (v + 1) % STAGES.length), 3800);
    return () => clearInterval(t);
  }, [auto]);
  const s = STAGES[i];

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr]">
      <ol className="border-t border-ink">
        {STAGES.map((st, k) => (
          <li key={st.n}>
            <button
              onClick={() => { setI(k); setAuto(false); }}
              className={`group relative flex w-full items-baseline gap-5 border-b border-rule py-4 text-left transition ${k === i ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}
            >
              <span className="font-mono text-[11px]">{st.n}</span>
              <span className="font-display text-[26px] leading-none sm:text-[30px]">{st.name}</span>
              <span className="ml-auto font-mono text-[11px]">{st.time}</span>
              {k === i && (
                <span className="absolute bottom-[-1px] left-0 h-[2px] bg-signal" style={{ width: auto ? undefined : '100%', animation: auto ? 'grow 3.8s linear forwards' : undefined }} />
              )}
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-col">
        <p key={s.n + 'b'} className="rise max-w-lg text-[17px] leading-relaxed text-ink-2">{s.body}</p>
        <div className="mt-6 flex-1 rounded-[3px] bg-ink p-5 text-g-200">
          <div className="mb-3 flex items-center justify-between">
            <span className="label-mono text-g-500">stage {s.n} · output</span>
            <span className="label-mono text-signal">{s.time}</span>
          </div>
          <pre key={s.n} className="rise overflow-x-auto font-mono text-[12.5px] leading-[1.7]">{s.out}</pre>
        </div>
      </div>
      <style>{`@keyframes grow { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
};

/* ─────────────── Calibration playground ─────────────── */

export const CalibrationPlayground: React.FC = () => {
  const [p, setP] = useState(0.72);
  const [k, setK] = useState(8);
  const W = 520, H = 300, pad = 34;
  const x = (v: number) => pad + v * (W - pad * 2);
  const y = (v: number) => H - pad - v * (H - pad * 2);
  const path = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 100; i++) { const v = i / 100; pts.push(`${i ? 'L' : 'M'}${x(v).toFixed(1)},${y(platt(v, k)).toFixed(1)}`); }
    return pts.join('');
  }, [k]);
  const c = Math.min(0.99, Math.max(0.01, platt(p, k)));
  const band = c >= 0.85 ? 'High' : c >= 0.6 ? 'Moderate' : c >= 0.25 ? 'Low' : 'Uncalibrated';
  const bands = [
    { from: 0.85, to: 1, label: 'HIGH' },
    { from: 0.6, to: 0.85, label: 'MODERATE' },
    { from: 0.25, to: 0.6, label: 'LOW' },
    { from: 0, to: 0.25, label: 'UNCALIBRATED' },
  ];

  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.25fr_1fr]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {bands.map((b, i) => (
          <g key={b.label}>
            <rect x={pad} y={y(b.to)} width={W - pad * 2} height={y(b.from) - y(b.to)} fill={i % 2 ? '#e9e5da' : '#f2efe7'} />
            <text x={W - pad - 4} y={y(b.to) + 12} textAnchor="end" fontFamily="IBM Plex Mono" fontSize="9" fill="#6d6f74">{b.label}</text>
          </g>
        ))}
        <line x1={pad} y1={y(0)} x2={W - pad} y2={y(0)} stroke="#141518" />
        <line x1={pad} y1={y(0)} x2={pad} y2={y(1)} stroke="#141518" />
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <text x={x(v)} y={H - pad + 16} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9.5" fill="#6d6f74">{v}</text>
            <text x={pad - 8} y={y(v) + 3} textAnchor="end" fontFamily="IBM Plex Mono" fontSize="9.5" fill="#6d6f74">{v}</text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#6d6f74" strokeDasharray="3 4" />
        <path d={path} fill="none" stroke="#141518" strokeWidth="2" />
        <line x1={x(p)} y1={y(0)} x2={x(p)} y2={y(c)} stroke="#e4572e" strokeDasharray="2 3" />
        <line x1={pad} y1={y(c)} x2={x(p)} y2={y(c)} stroke="#e4572e" strokeDasharray="2 3" />
        <circle cx={x(p)} cy={y(c)} r="6" fill="#e4572e" stroke="#f2efe7" strokeWidth="2" />
        <text x={W / 2} y={H - 4} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9.5" fill="#3b3d42">RAW MODEL PROBABILITY</text>
      </svg>

      <div>
        <div className="grid grid-cols-2 border-y border-ink">
          <div className="border-r border-rule py-4 pr-4">
            <p className="label-mono text-ink-3">raw</p>
            <p className="font-display text-[56px] leading-none tabular-nums">{p.toFixed(2)}</p>
          </div>
          <div className="py-4 pl-4">
            <p className="label-mono text-ink-3">calibrated</p>
            <p className="font-display text-[56px] leading-none tabular-nums text-signal">{c.toFixed(2)}</p>
          </div>
        </div>
        <p className="mt-3 font-mono text-[12px] text-ink-2">band → <b className="text-ink">{band}</b></p>
        <label className="mt-6 block">
          <span className="label-mono flex justify-between text-ink-3"><span>raw probability</span><span>{p.toFixed(2)}</span></span>
          <input type="range" min={0} max={1} step={0.01} value={p} onChange={e => setP(+e.target.value)} className="slider slider-ink mt-3" />
        </label>
        <label className="mt-5 block">
          <span className="label-mono flex justify-between text-ink-3"><span>steepness k</span><span>{k.toFixed(1)}</span></span>
          <input type="range" min={1} max={16} step={0.5} value={k} onChange={e => setK(+e.target.value)} className="slider slider-ink mt-3" />
        </label>
        <p className="mt-5 text-[13px] leading-relaxed text-ink-3">
          Production uses k = 8 around a 0.5 midpoint. Move the slider to see why a 0.55 detection is still banded <i>Low</i> while 0.75 clears <i>High</i>.
        </p>
      </div>
    </div>
  );
};

/* ─────────────── Reasoning graph trace ─────────────── */

const DEMO_FINDINGS: Finding[] = [
  { name: 'Glioma Tumor', location: 'Left Frontal Lobe', probability: 0.88, severity: 'Severe', evidence: 'T2/FLAIR Hyperintensity', box: null },
  { name: 'Hyperintensity', location: 'Right Temporal Lobe', probability: 0.71, severity: 'Moderate', evidence: 'T2/FLAIR Hyperintense Lesion', box: null },
];

const TRACE_COLS = ['Finding', 'Disease', 'Severity', 'Recommendation'];
const TRACE_X = [20, 270, 520, 700];
const TRACE_W = [210, 200, 150, 260];
const W_TRACE = 980, H_TRACE = 440;

export const GraphTrace: React.FC = () => {
  const cols = TRACE_COLS, colX = TRACE_X, W = W_TRACE, H = H_TRACE;
  const kg = useMemo(() => buildGraph(DEMO_FINDINGS, 'brain_mri'), []);
  const [focus, setFocus] = useState<string | null>(null);

  const layout = useMemo(() => {
    const pos: Record<string, { x: number; y: number; w: number; h: number }> = {};
    TRACE_COLS.forEach((t, ci) => {
      const list = kg.nodes.filter(n => n.type === t);
      const gap = H_TRACE / (list.length + 1);
      list.forEach((n, i) => { pos[n.id] = { x: TRACE_X[ci], y: gap * (i + 1) - 18, w: TRACE_W[ci], h: 36 }; });
    });
    return pos;
  }, [kg]);

  const connected = useMemo(() => {
    if (!focus) return null;
    const set = new Set([focus]);
    const walk = (id: string, dir: 'down' | 'up') => {
      kg.edges.forEach(e => {
        const [from, to] = dir === 'down' ? [e.source, e.target] : [e.target, e.source];
        if (from === id && !set.has(to)) { set.add(to); walk(to, dir); }
      });
    };
    walk(focus, 'down'); walk(focus, 'up');
    return set;
  }, [focus, kg]);

  const on = (id: string) => !connected || connected.has(id);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 30}`} className="min-w-[760px] w-full">
        {cols.map((c, i) => (
          <text key={c} x={colX[i]} y={14} fontFamily="IBM Plex Mono" fontSize="10" letterSpacing="1" fill="#6d6f74">{['SEEN', 'SUGGESTS', 'SEVERITY', 'NEXT STEP'][i]}</text>
        ))}
        <g transform="translate(0,26)">
          {kg.edges.map((e, i) => {
            const a = layout[e.source], b = layout[e.target];
            if (!a || !b) return null;
            const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
            const lit = connected ? connected.has(e.source) && connected.has(e.target) : false;
            return (
              <path
                key={i}
                d={`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`}
                fill="none"
                stroke={lit ? '#e4572e' : '#141518'}
                strokeOpacity={connected && !lit ? 0.12 : lit ? 1 : 0.4}
                strokeWidth={lit ? 1.8 : 1}
                className={lit ? 'flow' : ''}
              />
            );
          })}
          {kg.nodes.map(n => {
            const p = layout[n.id];
            if (!p) return null;
            const isF = focus === n.id;
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                opacity={on(n.id) ? 1 : 0.25}
                onMouseEnter={() => setFocus(n.id)}
                onMouseLeave={() => setFocus(null)}
                style={{ cursor: 'pointer', transition: 'opacity .2s' }}
              >
                <rect width={p.w} height={p.h} rx="2" fill={isF ? '#141518' : n.type === 'Disease' ? '#e9e5da' : '#f2efe7'} stroke="#141518" />
                {n.type === 'Finding' && <rect width="4" height={p.h} fill="#e4572e" />}
                <text x={12} y={p.h / 2 + 4} fontFamily="IBM Plex Sans" fontSize="12" fill={isF ? '#f2efe7' : '#141518'}>
                  {n.label.length > 34 ? `${n.label.slice(0, 33)}…` : n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
