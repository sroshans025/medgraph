import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutGrid, ListOrdered, Plus, Archive, Settings as Cog, Search, CornerDownLeft, ArrowLeft, Check, AlertTriangle, X,
} from 'lucide-react';
import { navigate } from '../lib/router';
import { useWorkspace } from './store';
import { Kbd, SevPill } from '../components/ui';
import { getSettings } from '../services/api';

const NAV = [
  { path: '/app', key: 'overview', label: 'Overview', icon: LayoutGrid, hint: 'G O' },
  { path: '/app/worklist', key: 'worklist', label: 'Worklist', icon: ListOrdered, hint: 'G W' },
  { path: '/app/new', key: 'new', label: 'New study', icon: Plus, hint: 'N' },
  { path: '/app/archive', key: 'archive', label: 'Archive', icon: Archive, hint: 'G A' },
  { path: '/app/settings', key: 'settings', label: 'Settings', icon: Cog, hint: 'G S' },
];

const Palette: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { cases } = useWorkspace();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const items = useMemo(() => {
    const ql = q.toLowerCase().trim();
    const nav = NAV.map(n => ({ kind: 'nav' as const, id: n.path, title: n.label, sub: 'Go to', run: () => navigate(n.path) }));
    const cmds = [
      { kind: 'cmd' as const, id: 'sample-cr', title: 'Run sample chest radiograph', sub: 'Command', run: () => navigate('/app/new?sample=chest_xray') },
      { kind: 'cmd' as const, id: 'sample-mr', title: 'Run sample brain MRI', sub: 'Command', run: () => navigate('/app/new?sample=brain_mri') },
      { kind: 'cmd' as const, id: 'landing', title: 'Back to landing page', sub: 'Command', run: () => navigate('/') },
    ];
    const studies = cases.map(c => ({
      kind: 'case' as const, id: c.case_id,
      title: `${c.metadata.patient_id ?? 'Unknown'} · ${c.findings.map(f => f.name).join(', ') || 'No findings'}`,
      sub: c.case_id.slice(0, 8), sev: c.severity,
      run: () => navigate(`/app/case/${c.case_id}`),
    }));
    const all = [...nav, ...cmds, ...studies];
    if (!ql) return all.slice(0, 12);
    return all.filter(i => `${i.title} ${i.sub}`.toLowerCase().includes(ql)).slice(0, 12);
  }, [q, cases]);

  useEffect(() => setSel(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    if (e.key === 'Enter' && items[sel]) { items[sel].run(); onClose(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[14vh]" onClick={onClose}>
      <div className="rise w-[600px] max-w-[92vw] overflow-hidden rounded-[6px] border border-g-600 bg-g-850 shadow-2xl" onClick={e => e.stopPropagation()} onKeyDown={onKey}>
        <div className="flex items-center gap-3 border-b border-g-700 px-4">
          <Search className="h-4 w-4 text-g-400" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search patients, studies, commands…" className="h-12 flex-1 bg-transparent text-[14px] text-g-100 placeholder:text-g-500 focus:outline-none" />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-[380px] overflow-y-auto py-1.5">
          {items.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-g-400">No matches</li>}
          {items.map((it, i) => (
            <li key={it.id}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => { it.run(); onClose(); }}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === sel ? 'bg-g-700' : ''}`}
              >
                <span className="label-mono w-14 shrink-0 text-g-500">{it.kind === 'case' ? 'study' : it.kind}</span>
                <span className="flex-1 truncate text-[13px] text-g-100">{it.title}</span>
                {'sev' in it && it.sev && <SevPill sev={it.sev} />}
                <span className="font-mono text-[11px] text-g-500">{it.sub}</span>
                {i === sel && <CornerDownLeft className="h-3.5 w-3.5 text-g-400" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const Shell: React.FC<{ section: string; children: React.ReactNode }> = ({ section, children }) => {
  const { mode, toasts, cases, metaFor } = useWorkspace();
  const [palette, setPalette] = useState(false);
  const unread = cases.filter(c => metaFor(c.case_id).status !== 'signed').length;
  const reviewer = getSettings().reviewer;

  useEffect(() => {
    let g = false; let gt: number | undefined;
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); return; }
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '/') { e.preventDefault(); setPalette(true); return; }
      if (g) {
        const map: Record<string, string> = { o: '/app', w: '/app/worklist', a: '/app/archive', s: '/app/settings' };
        if (map[e.key]) navigate(map[e.key]);
        g = false; return;
      }
      if (e.key === 'g') { g = true; clearTimeout(gt); gt = window.setTimeout(() => (g = false), 900); }
      if (e.key === 'n') navigate('/app/new');
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  return (
    <div className="flex min-h-screen bg-g-950 text-g-100">
      {/* Rail */}
      <aside className="no-print sticky top-0 hidden h-screen w-[216px] shrink-0 flex-col border-r border-g-700 bg-g-900 md:flex">
        <a href="#/" className="flex h-14 items-center gap-2.5 border-b border-g-700 px-4">
          <svg viewBox="0 0 32 32" className="h-6 w-6 text-g-100" aria-hidden>
            <rect x="1" y="1" width="30" height="30" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="11" cy="12" r="3" fill="currentColor" /><circle cx="22" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="20" cy="22" r="3" fill="#e4572e" /><path d="M11 12L22 10M11 12L20 22M22 10L20 22" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <span className="text-[14px] font-semibold tracking-tight">MedGraph</span>
          <span className="label-mono ml-auto text-g-500">RR-1</span>
        </a>

        <button onClick={() => setPalette(true)} className="mx-3 mt-3 flex h-8 items-center gap-2 rounded-[4px] border border-g-700 bg-g-950 px-2.5 text-[12.5px] text-g-400 hover:border-g-600">
          <Search className="h-3.5 w-3.5" /> Search <span className="ml-auto"><Kbd>⌘K</Kbd></span>
        </button>

        <nav className="mt-4 flex-1 space-y-0.5 px-2">
          {NAV.map(n => {
            const active = section === n.key;
            const Icon = n.icon;
            return (
              <a
                key={n.key}
                href={`#${n.path}`}
                className={`group relative flex h-9 items-center gap-3 rounded-[4px] px-3 text-[13px] transition ${active ? 'bg-g-800 text-g-100' : 'text-g-400 hover:bg-g-850 hover:text-g-100'}`}
              >
                {active && <span className="absolute -left-2 top-2 bottom-2 w-[2px] bg-signal" />}
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {n.label}
                {n.key === 'worklist' && unread > 0 && <span className="ml-auto font-mono text-[11px] text-g-300">{unread}</span>}
                {n.key !== 'worklist' && <span className="ml-auto hidden font-mono text-[10px] text-g-500 group-hover:inline">{n.hint}</span>}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-g-700 p-3">
          <div className={`mb-3 flex items-center gap-2 rounded-[4px] border px-2.5 py-2 ${mode === 'live' ? 'border-sev-minimal/30' : 'border-g-700'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${mode === 'live' ? 'bg-sev-minimal' : 'bg-sev-moderate'}`} />
            <div className="leading-tight">
              <p className="text-[12px] text-g-100">{mode === 'live' ? 'Inference API' : 'Demo engine'}</p>
              <p className="font-mono text-[10px] text-g-500">{mode === 'live' ? 'connected' : 'in-browser · synthetic'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-g-700 font-mono text-[11px] text-g-100">
              {reviewer.replace(/^Dr\.?\s*/, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[12.5px] text-g-100">{reviewer}</p>
              <p className="truncate text-[10.5px] text-g-500">{getSettings().credentials}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="no-print flex h-12 items-center gap-3 border-b border-g-700 bg-g-900 px-4 md:hidden">
          <a href="#/" className="text-g-400"><ArrowLeft className="h-4 w-4" /></a>
          <span className="text-[13px] font-semibold">MedGraph</span>
          <div className="ml-auto flex gap-1">
            {NAV.map(n => (
              <a key={n.key} href={`#${n.path}`} className={`rounded-[3px] p-2 ${section === n.key ? 'bg-g-800 text-g-100' : 'text-g-400'}`}><n.icon className="h-4 w-4" /></a>
            ))}
          </div>
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {palette && <Palette onClose={() => setPalette(false)} />}

      {/* Toasts */}
      <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className="rise flex items-center gap-2.5 rounded-[4px] border border-g-600 bg-g-800 px-3.5 py-2.5 text-[13px] text-g-100 shadow-xl">
            {t.tone === 'err' ? <X className="h-4 w-4 text-sev-critical" /> : t.tone === 'warn' ? <AlertTriangle className="h-4 w-4 text-sev-moderate" /> : <Check className="h-4 w-4 text-sev-minimal" />}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
};
