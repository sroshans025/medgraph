import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiService, detectMode, getAllMeta, getMeta, logAudit, putMeta,
  type CaseMeta, type DiagnosticResult, type Mode,
} from '../services/api';

export interface Toast { id: number; text: string; tone?: 'ok' | 'warn' | 'err' }

interface Ctx {
  ready: boolean;
  mode: Mode;
  cases: DiagnosticResult[];
  meta: Record<string, CaseMeta>;
  refresh: () => Promise<void>;
  recheckMode: () => Promise<void>;
  upsertCase: (c: DiagnosticResult) => void;
  metaFor: (id: string) => CaseMeta;
  setStatus: (id: string, status: CaseMeta['status'], extra?: Partial<CaseMeta>) => void;
  audit: (id: string, action: string, detail?: string) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  toasts: Toast[];
}

const WorkspaceCtx = createContext<Ctx | null>(null);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>('demo');
  const [cases, setCases] = useState<DiagnosticResult[]>([]);
  const [meta, setMeta] = useState<Record<string, CaseMeta>>(getAllMeta());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const syncMeta = () => setMeta({ ...getAllMeta() });

  const refresh = useCallback(async () => {
    const list = await apiService.getHistory();
    list.sort((a, b) => (b.metadata.created_at ?? '').localeCompare(a.metadata.created_at ?? ''));
    setCases(list);
    syncMeta();
  }, []);

  const recheckMode = useCallback(async () => {
    setMode(await detectMode());
    await refresh();
  }, [refresh]);

  useEffect(() => {
    (async () => { await recheckMode(); setReady(true); })();
  }, [recheckMode]);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  const value = useMemo<Ctx>(() => ({
    ready, mode, cases, meta, refresh, recheckMode, toast, toasts,
    upsertCase: (c) => { setCases(prev => [c, ...prev.filter(p => p.case_id !== c.case_id)]); syncMeta(); },
    metaFor: (id) => meta[id] ?? getMeta(id),
    setStatus: (id, status, extra) => {
      putMeta(id, m => ({ ...m, ...extra, status }));
      syncMeta();
    },
    audit: (id, action, detail) => { logAudit(id, action, detail); syncMeta(); },
  }), [ready, mode, cases, meta, refresh, recheckMode, toast, toasts]);

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
};

export function useWorkspace() {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error('useWorkspace outside provider');
  return c;
}
