import React, { useEffect, useMemo, useRef, useState } from 'react';
import { chestXraySvg, brainMriSvg, svgToDataUrl, type Box } from '../lib/scanArt';
import { platt } from '../lib/engine';

type Mod = 'chest_xray' | 'brain_mri';
const MAG = 1.7;

interface Spot { box: Box; name: string; p: number; region: string }

const SPOTS: Record<Mod, Spot[]> = {
  chest_xray: [
    { box: [148, 318, 222, 384], name: 'Opacity', p: 0.91, region: 'Right lower lobe' },
    { box: [322, 196, 368, 236], name: 'Nodule', p: 0.64, region: 'Left middle lobe' },
  ],
  brain_mri: [
    { box: [302, 196, 356, 248], name: 'Glioma', p: 0.88, region: 'Left frontal lobe' },
  ],
};

function regionAt(mod: Mod, x: number, y: number) {
  if (mod === 'chest_xray') {
    if (x > 226 && x < 286) return 'Mediastinum';
    const h = x < 256 ? 'R' : 'L';
    return `${h} ${y < 170 ? 'upper' : y < 340 ? 'middle' : 'lower'} zone`;
  }
  const dx = (x - 256) / 156, dy = (y - 262) / 190;
  if (dx * dx + dy * dy > 1) return 'Extra-axial';
  return `${x < 256 ? 'R' : 'L'} ${y < 200 ? 'frontal' : y < 340 ? 'temporal' : 'occipital'}`;
}

export const HeroLoupe: React.FC = () => {
  const [mod, setMod] = useState<Mod>('chest_xray');
  const [pos, setPos] = useState({ x: 190, y: 340 });
  const [radius, setRadius] = useState(92);
  const [hovering, setHovering] = useState(false);
  const [locked, setLocked] = useState<Spot | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const t0 = useRef(performance.now());

  const spots = SPOTS[mod];
  const base = useMemo(() => svgToDataUrl(mod === 'chest_xray' ? chestXraySvg(7, spots.map(s => s.box)) : brainMriSvg(11, spots.map(s => s.box))), [mod, spots]);

  // Idle drift: the loupe wanders across the film until the visitor takes over.
  useEffect(() => {
    if (hovering || locked) return;
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - t0.current) / 1000;
      setPos({ x: 256 + Math.sin(t * 0.55) * 120 + Math.sin(t * 1.3) * 18, y: 270 + Math.sin(t * 0.8 + 1) * 110 });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hovering, locked, mod]);

  // Wheel resizes the loupe while hovering the film.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setRadius(r => Math.max(54, Math.min(170, r - Math.sign(e.deltaY) * 8)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const toLocal = (e: React.PointerEvent) => {
    const rect = frameRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * 512, y: ((e.clientY - rect.top) / rect.height) * 512 };
  };

  const nearest = useMemo(() => {
    let best: { s: Spot; d: number } | null = null;
    for (const s of spots) {
      const cx = (s.box[0] + s.box[2]) / 2, cy = (s.box[1] + s.box[3]) / 2;
      const d = Math.hypot(cx - pos.x, cy - pos.y);
      if (!best || d < best.d) best = { s, d };
    }
    return best;
  }, [pos, spots]);

  const inLoupe = nearest && nearest.d < radius * 0.9 ? nearest.s : null;
  const active = locked ?? inLoupe;
  const mm = (v: number) => ((v - 256) * 0.5).toFixed(1);
  const intensity = Math.round(
    (mod === 'chest_xray' ? 220 - Math.abs(pos.x - 256) * 0.5 : 180 - Math.hypot(pos.x - 256, pos.y - 262) * 0.3) +
    (inLoupe ? 160 * (1 - nearest!.d / radius) : 0)
  );

  const pct = (v: number) => `${(v / 512) * 100}%`;

  return (
    <div className="relative">
      {/* Film */}
      <div className="rounded-[4px] bg-ink p-3 shadow-[0_30px_60px_-30px_rgba(20,21,24,.55)]">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex gap-1">
            {(['chest_xray', 'brain_mri'] as Mod[]).map(m => (
              <button
                key={m}
                onClick={() => { setMod(m); setLocked(null); }}
                className={`label-mono rounded-[3px] px-2 py-1 transition ${mod === m ? 'bg-paper text-ink' : 'text-g-400 hover:text-g-100'}`}
              >
                {m === 'chest_xray' ? 'CR · Chest PA' : 'MR · Ax T2'}
              </button>
            ))}
          </div>
          <span className="label-mono flex items-center gap-1.5 text-g-400">
            <span className="h-1.5 w-1.5 rounded-full bg-signal blink" /> live inference
          </span>
        </div>

        <div
          ref={frameRef}
          className="relative aspect-square w-full cursor-none select-none overflow-hidden rounded-[2px] bg-black touch-none"
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
          onPointerMove={e => !locked && setPos(toLocal(e))}
          onClick={() => setLocked(l => (l ? null : inLoupe))}
        >
          <img src={base} alt="Rendered chest radiograph" className="absolute inset-0 h-full w-full" draggable={false} />

          {/* Revealed analysis layer — magnified, clipped to the loupe */}
          <div
            className="absolute inset-0"
            style={{ clipPath: `circle(${(radius / 512) * 100}% at ${pct(pos.x)} ${pct(pos.y)})` }}
          >
            <div className="absolute inset-0 bg-black" />
            <div className="absolute inset-0" style={{ transform: `scale(${MAG})`, transformOrigin: `${pct(pos.x)} ${pct(pos.y)}` }}>
              <img src={base} alt="" className="absolute inset-0 h-full w-full" style={{ filter: 'contrast(1.45) brightness(1.15)' }} draggable={false} />
              <svg viewBox="0 0 512 512" className="absolute inset-0 h-full w-full">
                <defs>
                  <radialGradient id="heat">
                    <stop offset="0" stopColor="#e4572e" stopOpacity=".7" />
                    <stop offset=".55" stopColor="#e4572e" stopOpacity=".22" />
                    <stop offset="1" stopColor="#e4572e" stopOpacity="0" />
                  </radialGradient>
                  <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
                    <path d="M8 0H0V8" fill="none" stroke="#fff" strokeOpacity=".07" strokeWidth=".5" />
                  </pattern>
                </defs>
                <rect width="512" height="512" fill="url(#grid)" />
                {spots.map((s, i) => {
                  const [x1, y1, x2, y2] = s.box;
                  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
                  const t = 6;
                  return (
                    <g key={i}>
                      <ellipse cx={cx} cy={cy} rx={(x2 - x1) * 0.8} ry={(y2 - y1) * 0.8} fill="url(#heat)" />
                      {[0.55, 0.8, 1.05].map(k => (
                        <ellipse key={k} cx={cx} cy={cy} rx={(x2 - x1) * 0.5 * k + 4} ry={(y2 - y1) * 0.5 * k + 3} fill="none" stroke="#f6c9b8" strokeOpacity={0.6 - k * 0.3} strokeWidth=".6" />
                      ))}
                      <path d={`M${x1},${y1 + t}V${y1}H${x1 + t} M${x2 - t},${y1}H${x2}V${y1 + t} M${x2},${y2 - t}V${y2}H${x2 - t} M${x1 + t},${y2}H${x1}V${y2 - t}`} stroke="#fff" strokeWidth="1" fill="none" />
                      <rect x={x1} y={y1 - 11} width={s.name.length * 4.6 + 30} height="9.5" fill="#e4572e" />
                      <text x={x1 + 2.5} y={y1 - 3.8} fontFamily="IBM Plex Mono, monospace" fontSize="6.4" fill="#fff">{s.name.toUpperCase()} {s.p.toFixed(2)}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Loupe chrome */}
          <svg viewBox="0 0 512 512" className="pointer-events-none absolute inset-0 h-full w-full">
            <circle cx={pos.x} cy={pos.y} r={radius} fill="none" stroke="#f2efe7" strokeOpacity=".9" strokeWidth="1.2" />
            <circle cx={pos.x} cy={pos.y} r={radius + 5} fill="none" stroke="#f2efe7" strokeOpacity=".25" strokeDasharray="1 5" />
            {Array.from({ length: 24 }).map((_, i) => {
              const a = (i / 24) * Math.PI * 2;
              const l = i % 6 === 0 ? 8 : 4;
              return <line key={i} x1={pos.x + Math.cos(a) * radius} y1={pos.y + Math.sin(a) * radius} x2={pos.x + Math.cos(a) * (radius - l)} y2={pos.y + Math.sin(a) * (radius - l)} stroke="#f2efe7" strokeOpacity=".7" />;
            })}
            <line x1={pos.x - 10} y1={pos.y} x2={pos.x + 10} y2={pos.y} stroke="#e4572e" />
            <line x1={pos.x} y1={pos.y - 10} x2={pos.x} y2={pos.y + 10} stroke="#e4572e" />
            {locked && <text x={pos.x + radius + 10} y={pos.y + 4} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#f2efe7">LOCKED</text>}
          </svg>

          {!hovering && !locked && (
            <div className="label-mono absolute bottom-3 left-3 rounded-[2px] bg-black/60 px-2 py-1 text-g-300">
              move to inspect · scroll to zoom · click to lock
            </div>
          )}
        </div>

        {/* Readout */}
        <div className="mt-2 grid grid-cols-2 gap-px sm:grid-cols-4 overflow-hidden rounded-[2px] bg-g-700 font-mono text-[10.5px]">
          {[
            ['POS mm', `${mm(pos.x)}, ${mm(pos.y)}`],
            ['REGION', regionAt(mod, pos.x, pos.y)],
            ['SIGNAL', `${Math.max(0, Math.min(255, intensity))}`],
            ['LOUPE', `${MAG}× · r${Math.round(radius * 0.5)}mm`],
          ].map(([k, v]) => (
            <div key={k} className="bg-ink px-2 py-1.5">
              <div className="text-g-500">{k}</div>
              <div className="truncate text-g-100 tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Finding callout */}
      {active && <div
        className={`absolute -bottom-6 -left-6 hidden w-64 rounded-[3px] border border-ink bg-paper p-3 text-ink shadow-[6px_6px_0_0_#141518] md:block rise`}
      >
        {active && (
          <>
            <div className="flex items-baseline justify-between">
              <span className="label-mono text-ink-3">finding</span>
              <span className="label-mono text-signal">{locked ? 'locked' : 'in view'}</span>
            </div>
            <p className="mt-1 font-display text-[26px] leading-none">{active.name}</p>
            <p className="mt-1 text-[12px] text-ink-2">{active.region}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-rule pt-2 font-mono text-[11px]">
              <div><div className="text-ink-3">raw p</div>{active.p.toFixed(2)}</div>
              <div><div className="text-ink-3">platt</div>{platt(active.p).toFixed(2)}</div>
              <div><div className="text-ink-3">size</div>{((active.box[2] - active.box[0]) * 0.05).toFixed(1)}×{((active.box[3] - active.box[1]) * 0.05).toFixed(1)} cm</div>
              <div><div className="text-ink-3">trace</div>→ {mod === 'chest_xray' ? 'Pneumonia' : 'Glioma'}</div>
            </div>
          </>
        )}
      </div>}
    </div>
  );
};
