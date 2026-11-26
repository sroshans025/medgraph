import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft } from 'lucide-react';
import { useWorkspace } from '../store';
import { apiService, type DiagnosticResult } from '../../services/api';
import { Empty, ModalityTag, SevPill } from '../../components/ui';

const COLS = ['Finding', 'Disease', 'Severity', 'Recommendation'] as const;
const COL_X = [0, 250, 470, 650];
const TYPE_STYLE: Record<string, React.CSSProperties> = {
  Finding: { background: '#16181b', color: '#efede8', border: '1px solid #e4572e', borderLeft: '4px solid #e4572e' },
  Disease: { background: '#efede8', color: '#0b0c0e', border: '1px solid #efede8', fontWeight: 600 },
  Severity: { background: '#111215', color: '#dcdcd8', border: '1px dashed #868b93' },
  Recommendation: { background: '#111215', color: '#b3b6bb', border: '1px solid #353940' },
};
const RULES: Record<string, string> = {
  SUGGESTS: 'Finding pattern maps to this differential in the builder rule table.',
  HAS_SEVERITY: 'Severity inherited from the finding that produced this differential.',
  REQUIRES: 'Guideline action attached to this differential at this severity.',
};

export const GraphView: React.FC<{ id: string }> = ({ id }) => {
  const { cases } = useWorkspace();
  const [c, setC] = useState<DiagnosticResult | null>(cases.find(x => x.case_id === id) ?? null);
  const [sel, setSel] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!c) apiService.getCase(id).then(setC).catch(() => {});
  }, [id, c]);

  const kg = c?.knowledge_graph;

  const lineage = useMemo(() => {
    if (!sel || !kg) return null;
    const set = new Set([sel]);
    const walk = (nid: string, down: boolean) => kg.edges.forEach(e => {
      const [a, b] = down ? [e.source, e.target] : [e.target, e.source];
      if (a === nid && !set.has(b)) { set.add(b); walk(b, down); }
    });
    walk(sel, true); walk(sel, false);
    return set;
  }, [sel, kg]);

  const nodes = useMemo<Node[]>(() => {
    if (!kg) return [];
    return COLS.flatMap((t, ci) => {
      const list = kg.nodes.filter(n => (COLS.includes(n.type as any) ? n.type : 'Recommendation') === t);
      return list.map((n, i) => ({
        id: n.id,
        position: { x: COL_X[ci], y: i * 86 - (list.length - 1) * 43 },
        data: { label: n.label },
        hidden: hidden.has(t),
        sourcePosition: 'right' as any,
        targetPosition: 'left' as any,
        style: {
          ...TYPE_STYLE[t],
          width: t === 'Recommendation' ? 250 : t === 'Severity' ? 150 : 200,
          borderRadius: 3, fontSize: 12.5, padding: '10px 12px', textAlign: 'left' as const, fontFamily: 'IBM Plex Sans',
          opacity: lineage && !lineage.has(n.id) ? 0.2 : 1,
          boxShadow: sel === n.id ? '0 0 0 2px #e4572e' : 'none',
          transition: 'opacity .2s',
        },
      }));
    });
  }, [kg, lineage, sel, hidden]);

  const edges = useMemo<Edge[]>(() => {
    if (!kg) return [];
    return kg.edges.map((e, i) => {
      const lit = lineage ? lineage.has(e.source) && lineage.has(e.target) : false;
      return {
        id: `e${i}`, source: e.source, target: e.target, label: e.relation.replace('_', ' '),
        animated: lit, type: 'smoothstep',
        style: { stroke: lit ? '#e4572e' : '#565b63', strokeWidth: lit ? 1.8 : 1, opacity: lineage && !lit ? 0.15 : 1 },
        labelStyle: { fill: lit ? '#efede8' : '#868b93', fontSize: 9.5, fontFamily: 'IBM Plex Mono' },
        labelBgStyle: { fill: '#0b0c0e' }, labelBgPadding: [4, 2] as [number, number],
      };
    });
  }, [kg, lineage]);

  if (!c || !kg) return <div className="p-10"><Empty title="Loading graph…" /></div>;

  const node = sel ? kg.nodes.find(n => n.id === sel) : null;
  const incoming = sel ? kg.edges.filter(e => e.target === sel) : [];
  const outgoing = sel ? kg.edges.filter(e => e.source === sel) : [];
  const findingIdx = node?.type === 'Finding' ? Number(node.id.split('_')[1]) : -1;
  const finding = findingIdx >= 0 ? c.findings[findingIdx] : null;
  const label = (nid: string) => kg.nodes.find(n => n.id === nid)?.label ?? nid;

  return (
    <div className="flex h-screen flex-col max-md:h-auto">
      <header className="flex flex-wrap items-center gap-4 border-b border-g-700 bg-g-900 px-5 py-3">
        <a href={`#/app/case/${c.case_id}`} className="btn btn-ghost !px-2"><ArrowLeft className="h-4 w-4" /></a>
        <div>
          <div className="flex items-center gap-3"><h1 className="font-display text-[26px] leading-none">Reasoning graph</h1><ModalityTag modality={c.modality} /></div>
          <p className="mt-1 font-mono text-[10.5px] text-g-500">{c.metadata.patient_id} · {kg.nodes.length} nodes · {kg.edges.length} edges</p>
        </div>
        <SevPill sev={c.severity} size="md" />
        <div className="ml-auto flex flex-wrap gap-1">
          {COLS.map(t => (
            <button key={t} onClick={() => setHidden(h => { const n = new Set(h); n.has(t) ? n.delete(t) : n.add(t); return n; })}
              className={`h-7 rounded-[3px] border px-2.5 text-[11.5px] ${hidden.has(t) ? 'border-g-700 text-g-500 line-through' : 'border-g-500 text-g-200'}`}>
              {t === 'Recommendation' ? 'Actions' : t}
            </button>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_340px]">
        <div className="relative min-h-[520px] bg-g-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.18, maxZoom: 1.25 }}
            onInit={inst => setTimeout(() => inst.fitView({ padding: 0.18, maxZoom: 1.25 }), 60)}
            onNodeClick={(_, n) => setSel(s => (s === n.id ? null : n.id))}
            onPaneClick={() => setSel(null)}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#26292e" gap={24} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="border-l border-g-700 bg-g-900 p-5 max-lg:border-l-0 max-lg:border-t">
          {!node ? (
            <div>
              <p className="label-mono text-g-500">Inspector</p>
              <p className="mt-3 text-[13px] leading-relaxed text-g-300">Click a node to trace its lineage. Everything upstream and downstream stays lit; the rest fades.</p>
              <div className="mt-6 space-y-2">
                {COLS.map(t => (
                  <div key={t} className="flex items-center gap-3 text-[12.5px] text-g-300">
                    <span className="h-4 w-6 rounded-[2px]" style={TYPE_STYLE[t]} />
                    {t === 'Recommendation' ? 'Recommended action' : t}
                    <span className="ml-auto font-mono text-[11px] text-g-500">{kg.nodes.filter(n => n.type === t).length}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rise">
              <p className="label-mono text-signal">{node.type}</p>
              <h2 className="mt-2 font-display text-[28px] leading-tight">{node.label}</h2>
              <p className="mt-1 font-mono text-[10.5px] text-g-500">{node.id}</p>

              {finding && (
                <div className="mt-5 grid grid-cols-2 gap-3 rounded-[4px] border border-g-700 p-3 font-mono text-[11.5px]">
                  <div><p className="text-g-500">probability</p><p>{finding.probability.toFixed(2)}</p></div>
                  <div><p className="text-g-500">severity</p><p>{finding.severity}</p></div>
                  <div className="col-span-2"><p className="text-g-500">evidence</p><p className="font-sans text-[12.5px]">{finding.evidence}</p></div>
                  <div className="col-span-2"><p className="text-g-500">region</p><p>{finding.box?.map(Math.round).join(', ') ?? '—'}</p></div>
                </div>
              )}

              {[['Incoming', incoming, 'source'], ['Outgoing', outgoing, 'target']].map(([title, list, end]) => (list as any[]).length > 0 && (
                <div key={title as string} className="mt-6">
                  <p className="label-mono mb-2 text-g-500">{title as string}</p>
                  <ul className="space-y-2">
                    {(list as typeof incoming).map((e, i) => (
                      <li key={i}>
                        <button onClick={() => setSel(e[end as 'source' | 'target'])} className="w-full rounded-[4px] border border-g-700 p-2.5 text-left hover:border-g-500">
                          <p className="font-mono text-[10.5px] text-signal">{e.relation}</p>
                          <p className="text-[13px] text-g-100">{label(e[end as 'source' | 'target'])}</p>
                          <p className="mt-1 text-[11.5px] text-g-500">{RULES[e.relation]}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
