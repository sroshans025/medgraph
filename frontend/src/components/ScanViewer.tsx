import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Contrast, Eye, EyeOff, Hand, Maximize2, Minus, Plus, RotateCcw, Ruler } from 'lucide-react';
import type { Finding } from '../services/api';
import { SEV_COLOR } from './ui';

interface Props {
  src: string;
  findings: Finding[];
  burnedOverlay: boolean;
  hovered: number | null;
  onHover: (i: number | null) => void;
  patientId: string;
  modality: string;
}

type Tool = 'pan' | 'ruler';
interface Line { a: [number, number]; b: [number, number] }

const MM_PER_PX = 0.5; // matches backend: 1 px ≈ 0.05 cm on the 512 grid

export const ScanViewer: React.FC<Props> = ({ src, findings, burnedOverlay, hovered, onHover, patientId, modality }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [wl, setWl] = useState({ w: 1, l: 1 }); // contrast, brightness
  const [invert, setInvert] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [tool, setTool] = useState<Tool>('pan');
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState<Line | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setWl({ w: 1, l: 1 }); setInvert(false); setLines([]); };

  // Convert a pointer event into 512-grid image coordinates.
  const toImage = useCallback((clientX: number, clientY: number): [number, number] => {
    const r = wrapRef.current!.getBoundingClientRect();
    const cx = r.width / 2, cy = r.height / 2;
    const size = Math.min(r.width, r.height);
    const x = ((clientX - r.left - cx - pan.x) / zoom + size / 2) / size * 512;
    const y = ((clientY - r.top - cy - pan.y) / zoom + size / 2) / size * 512;
    return [x, y];
  }, [pan, zoom]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
      setZoom(z => {
        const nz = Math.max(0.6, Math.min(8, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        setPan(p => ({ x: mx - ((mx - p.x) * nz) / z, y: my - ((my - p.y) * nz) / z }));
        return nz;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'o') setOverlay(v => !v);
      if (e.key === 'i') setInvert(v => !v);
      if (e.key === 'r') reset();
      if (e.key === 'm') setTool(t => (t === 'ruler' ? 'pan' : 'ruler'));
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(8, z * 1.2));
      if (e.key === '-') setZoom(z => Math.max(0.6, z / 1.2));
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (tool === 'pan') dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    else { const p = toImage(e.clientX, e.clientY); setDraft({ a: p, b: p }); }
  };
  const onMove = (e: React.PointerEvent) => {
    const p = toImage(e.clientX, e.clientY);
    setCursor(p[0] >= 0 && p[0] <= 512 && p[1] >= 0 && p[1] <= 512 ? p : null);
    if (dragRef.current) {
      const d = dragRef.current;
      setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
    } else if (draft) setDraft({ ...draft, b: p });
  };
  const onUp = () => {
    dragRef.current = null;
    if (draft) {
      if (Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1]) > 4) setLines(l => [...l, draft]);
      setDraft(null);
    }
  };

  const len = (l: Line) => (Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) * MM_PER_PX).toFixed(1);
  const filter = `brightness(${wl.l}) contrast(${wl.w})${invert ? ' invert(1)' : ''}`;

  const ToolBtn: React.FC<{ on?: boolean; onClick: () => void; title: string; children: React.ReactNode }> = ({ on, onClick, title, children }) => (
    <button title={title} onClick={onClick} className={`flex h-8 w-8 items-center justify-center rounded-[3px] transition ${on ? 'bg-g-100 text-g-950' : 'text-g-300 hover:bg-g-700 hover:text-g-100'}`}>{children}</button>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[6px] border border-g-700 bg-black">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-g-700 bg-g-900 px-2 py-1.5">
        <ToolBtn on={tool === 'pan'} onClick={() => setTool('pan')} title="Pan (drag)"><Hand className="h-4 w-4" /></ToolBtn>
        <ToolBtn on={tool === 'ruler'} onClick={() => setTool('ruler')} title="Measure (M)"><Ruler className="h-4 w-4" /></ToolBtn>
        <span className="mx-1 h-5 w-px bg-g-700" />
        <ToolBtn onClick={() => setZoom(z => Math.max(0.6, z / 1.2))} title="Zoom out (-)"><Minus className="h-4 w-4" /></ToolBtn>
        <span className="w-12 text-center font-mono text-[11px] tabular-nums text-g-300">{Math.round(zoom * 100)}%</span>
        <ToolBtn onClick={() => setZoom(z => Math.min(8, z * 1.2))} title="Zoom in (+)"><Plus className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Fit"><Maximize2 className="h-4 w-4" /></ToolBtn>
        <span className="mx-1 h-5 w-px bg-g-700" />
        <ToolBtn on={invert} onClick={() => setInvert(v => !v)} title="Invert (I)"><Contrast className="h-4 w-4" /></ToolBtn>
        <ToolBtn on={overlay} onClick={() => setOverlay(v => !v)} title="Detections (O)">{overlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</ToolBtn>
        <ToolBtn onClick={reset} title="Reset (R)"><RotateCcw className="h-4 w-4" /></ToolBtn>
        <div className="ml-auto hidden items-center gap-4 pr-1 lg:flex">
          <label className="flex items-center gap-2"><span className="label-mono text-g-500">W</span><input type="range" min={0.5} max={2.5} step={0.05} value={wl.w} onChange={e => setWl(v => ({ ...v, w: +e.target.value }))} className="slider w-20" /></label>
          <label className="flex items-center gap-2"><span className="label-mono text-g-500">L</span><input type="range" min={0.4} max={1.8} step={0.05} value={wl.l} onChange={e => setWl(v => ({ ...v, l: +e.target.value }))} className="slider w-20" /></label>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={wrapRef}
        className={`relative flex-1 touch-none select-none overflow-hidden ${tool === 'ruler' ? 'cursor-crosshair' : dragRef.current ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ minHeight: 420 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => { setCursor(null); onUp(); }}
        onDoubleClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
      >
        <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center' }}>
          <div className="relative aspect-square h-full max-h-full max-w-full">
            <img src={src} alt="Study" className="absolute inset-0 h-full w-full object-contain" style={{ filter }} draggable={false} />
            <svg viewBox="0 0 512 512" className="absolute inset-0 h-full w-full overflow-visible">
              {overlay && !burnedOverlay && findings.map((f, i) => {
                if (!f.box) return null;
                const [x1, y1, x2, y2] = f.box;
                const c = SEV_COLOR[f.severity] ?? '#e4572e';
                const hot = hovered === i;
                const t = 8;
                return (
                  <g key={i} onPointerEnter={() => onHover(i)} onPointerLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
                    <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill={c} fillOpacity={hot ? 0.14 : 0} stroke={c} strokeOpacity={hot ? 1 : 0.35} strokeWidth={1 / zoom} strokeDasharray={hot ? undefined : `${3 / zoom} ${3 / zoom}`} />
                    <path d={`M${x1},${y1 + t}V${y1}H${x1 + t} M${x2 - t},${y1}H${x2}V${y1 + t} M${x2},${y2 - t}V${y2}H${x2 - t} M${x1 + t},${y2}H${x1}V${y2 - t}`} stroke={c} strokeWidth={2 / zoom} fill="none" />
                    <g transform={`translate(${x1},${y1 - 4 / zoom}) scale(${1 / zoom})`}>
                      <rect y={-15} width={(f.name.length + 12) * 6.05 + 6} height={15} fill={c} />
                      <text x={4} y={-4} fontFamily="IBM Plex Mono" fontSize="10" fill="#0b0c0e">{i + 1} · {f.name.toUpperCase()} {f.probability.toFixed(2)}</text>
                    </g>
                  </g>
                );
              })}
              {[...lines, ...(draft ? [draft] : [])].map((l, i) => (
                <g key={i}>
                  <line x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke="#f2c94c" strokeWidth={1.5 / zoom} />
                  {[l.a, l.b].map((p, k) => <circle key={k} cx={p[0]} cy={p[1]} r={3 / zoom} fill="#f2c94c" />)}
                  <g transform={`translate(${(l.a[0] + l.b[0]) / 2 + 6 / zoom},${(l.a[1] + l.b[1]) / 2 - 6 / zoom}) scale(${1 / zoom})`}>
                    <rect x={-2} y={-12} width={58} height={16} fill="#0b0c0e" fillOpacity=".85" />
                    <text x={2} y={0} fontFamily="IBM Plex Mono" fontSize="11" fill="#f2c94c">{len(l)} mm</text>
                  </g>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Corner annotations, DICOM-viewer style */}
        <div className="pointer-events-none absolute left-3 top-2 font-mono text-[10.5px] leading-[1.6] text-g-300/80">
          <div>{patientId}</div>
          <div>{modality === 'chest_xray' ? 'CR CHEST PA' : 'MR BRAIN AX T2'}</div>
        </div>
        <div className="pointer-events-none absolute right-3 top-2 text-right font-mono text-[10.5px] leading-[1.6] text-g-300/80">
          <div>W {Math.round(wl.w * 400)} L {Math.round(wl.l * 40)}</div>
          <div>Z {zoom.toFixed(2)}{invert ? ' INV' : ''}</div>
        </div>
        <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10.5px] text-g-300/80">
          {cursor ? `x ${cursor[0].toFixed(0)}  y ${cursor[1].toFixed(0)}  ·  ${((cursor[0] - 256) * MM_PER_PX).toFixed(1)}, ${((cursor[1] - 256) * MM_PER_PX).toFixed(1)} mm` : '512 × 512'}
        </div>
        <div className="pointer-events-none absolute bottom-2 right-3 font-mono text-[10.5px] text-g-300/80">
          {tool === 'ruler' ? 'drag to measure' : 'drag to pan · wheel to zoom'}
          {lines.length > 0 && <span> · {lines.length} measurement{lines.length > 1 ? 's' : ''}</span>}
        </div>
        {burnedOverlay && overlay && <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 font-mono text-[10px] text-g-500">overlay rendered by server</div>}
      </div>
    </div>
  );
};
