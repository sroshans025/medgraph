import React from 'react';
import type { ReviewStatus } from '../services/api';

export const SEV_COLOR: Record<string, string> = {
  Critical: 'var(--color-sev-critical)',
  Severe: 'var(--color-sev-severe)',
  Moderate: 'var(--color-sev-moderate)',
  Mild: 'var(--color-sev-mild)',
  Minimal: 'var(--color-sev-minimal)',
};
export const SEV_ORDER = ['Critical', 'Severe', 'Moderate', 'Mild', 'Minimal'];

export const SevPill: React.FC<{ sev: string; size?: 'sm' | 'md' }> = ({ sev, size = 'sm' }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-[3px] border font-mono uppercase tracking-wider ${size === 'sm' ? 'text-[10px] px-1.5 py-[1px]' : 'text-[11px] px-2 py-0.5'}`}
    style={{ color: SEV_COLOR[sev] ?? 'var(--color-g-300)', borderColor: `color-mix(in srgb, ${SEV_COLOR[sev] ?? '#888'} 40%, transparent)`, background: `color-mix(in srgb, ${SEV_COLOR[sev] ?? '#888'} 9%, transparent)` }}
  >
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEV_COLOR[sev] ?? '#888' }} />
    {sev}
  </span>
);

const STATUS: Record<ReviewStatus, { label: string; cls: string }> = {
  unread: { label: 'Unread', cls: 'text-g-100 border-g-500' },
  in_review: { label: 'In review', cls: 'text-sev-moderate border-sev-moderate/40' },
  signed: { label: 'Signed', cls: 'text-sev-minimal border-sev-minimal/40' },
};
export const StatusPill: React.FC<{ status: ReviewStatus }> = ({ status }) => (
  <span className={`inline-flex items-center rounded-[3px] border px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-wider ${STATUS[status].cls}`}>
    {status === 'unread' && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-signal" />}
    {STATUS[status].label}
  </span>
);

export const ModalityTag: React.FC<{ modality: string }> = ({ modality }) => (
  <span className="font-mono text-[10.5px] uppercase tracking-wider text-g-300">
    {modality === 'chest_xray' ? 'CR · Chest' : 'MR · Brain'}
  </span>
);

export const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] border border-g-600 bg-g-800 px-1 font-mono text-[10px] text-g-300">
    {children}
  </kbd>
);

export function relTime(iso?: string): string {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const Meter: React.FC<{ value: number; color?: string }> = ({ value, color = 'var(--color-g-200)' }) => (
  <div className="flex items-center gap-2">
    <div className="relative h-[3px] w-16 bg-g-700">
      <div className="absolute inset-y-0 left-0" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
    <span className="font-mono text-[11px] tabular-nums text-g-200">{Math.round(value * 100)}</span>
  </div>
);

export const SectionTitle: React.FC<{ kicker?: string; title: string; right?: React.ReactNode }> = ({ kicker, title, right }) => (
  <div className="mb-5 flex items-end justify-between gap-4">
    <div>
      {kicker && <p className="label-mono text-g-400">{kicker}</p>}
      <h1 className="mt-1 font-display text-[34px] leading-none tracking-tight text-g-100">{title}</h1>
    </div>
    {right}
  </div>
);

export const Empty: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
    <div className="h-8 w-8 rounded-full border border-dashed border-g-500" />
    <p className="text-[13px] text-g-200">{title}</p>
    {children && <div className="text-[12px] text-g-400">{children}</div>}
  </div>
);
