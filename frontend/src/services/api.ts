import axios from 'axios';
import {
  assembleCase, hashString, seedCases, simulateVision, uuid, type Modality,
} from '../lib/engine';
import { scanDataUrl, type Box } from '../lib/scanArt';

/* ——— Types (mirror backend/api/schemas) ——— */
export interface Finding {
  name: string;
  location: string;
  probability: number;
  severity: string;
  evidence: string;
  box: number[] | null;
}
export interface Evidence {
  finding_name: string;
  reason: string;
  measurement: string | null;
  confidence: number;
  supporting_region: number[] | null;
  visualization_path: string | null;
}
export interface Confidence {
  confidence_score: number;
  confidence_band: string;
  evidence_score: number;
  model_stability: number;
  prediction_reliability: number;
}
export interface GraphNode { id: string; label: string; type: string }
export interface GraphEdge { source: string; target: string; relation: string }
export interface KnowledgeGraph { nodes: GraphNode[]; edges: GraphEdge[] }
export interface Report {
  patient_summary: string;
  imaging_findings: string;
  evidence_summary: string;
  clinical_interpretation: string;
  severity_level: string;
  recommendations: string[];
  limitations: string;
  physician_review_required: boolean;
}
export interface DiagnosticResult {
  case_id: string;
  modality: string;
  metadata: Record<string, any>;
  findings: Finding[];
  evidence: Evidence[];
  knowledge_graph: KnowledgeGraph;
  severity: string;
  confidence: Confidence;
  overlay_url: string;
  report: Report;
}

/* ——— Client-side review state (works for both live and demo cases) ——— */
export type ReviewStatus = 'unread' | 'in_review' | 'signed';
export interface AuditEntry { at: string; actor: string; action: string; detail?: string }
export interface CaseMeta {
  status: ReviewStatus;
  signedBy?: string;
  signedAt?: string;
  audit: AuditEntry[];
  versions: { at: string; report: Report; note?: string }[];
}

export interface Settings { apiUrl: string; forceDemo: boolean; reviewer: string; credentials: string }

const LS = {
  settings: 'mg.settings.v1',
  demo: 'mg.demo.cases.v3',
  meta: 'mg.meta.v2',
};

const DEFAULT_API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api/v1';

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota */ }
}

export function getSettings(): Settings {
  return { apiUrl: DEFAULT_API, forceDemo: false, reviewer: 'Dr. A. Raman', credentials: 'MD, Radiology', ...read<Partial<Settings>>(LS.settings, {}) };
}
export function saveSettings(s: Settings) { write(LS.settings, s); }

export function getAllMeta(): Record<string, CaseMeta> { return read(LS.meta, {}); }
export function getMeta(id: string): CaseMeta {
  return getAllMeta()[id] ?? { status: 'unread', audit: [], versions: [] };
}
export function putMeta(id: string, patch: (m: CaseMeta) => CaseMeta): CaseMeta {
  const all = getAllMeta();
  const next = patch(all[id] ?? { status: 'unread', audit: [], versions: [] });
  all[id] = next;
  write(LS.meta, all);
  return next;
}
export function logAudit(id: string, action: string, detail?: string) {
  const actor = getSettings().reviewer;
  return putMeta(id, m => ({ ...m, audit: [{ at: new Date().toISOString(), actor, action, detail }, ...m.audit].slice(0, 100) }));
}

/* ——— Demo store ——— */
function demoCases(): DiagnosticResult[] {
  let cases = read<DiagnosticResult[] | null>(LS.demo, null);
  if (!cases) {
    cases = seedCases();
    write(LS.demo, cases);
    const meta = getAllMeta();
    // Give the seeded worklist some realistic review history
    cases.forEach((c, i) => {
      const created = c.metadata.created_at;
      const entry: CaseMeta = {
        status: i % 4 === 3 ? 'signed' : i % 3 === 1 ? 'in_review' : 'unread',
        audit: [{ at: created, actor: 'pipeline', action: 'Study ingested', detail: `${c.findings.length} finding(s), ${c.severity}` }],
        versions: [],
      };
      if (entry.status === 'signed') {
        entry.signedBy = 'Dr. L. Okafor';
        entry.signedAt = new Date(new Date(created).getTime() + 5400_000).toISOString();
        entry.audit.unshift({ at: entry.signedAt, actor: 'Dr. L. Okafor', action: 'Report signed' });
      }
      meta[c.case_id] = meta[c.case_id] ?? entry;
    });
    write(LS.meta, meta);
  }
  return cases;
}
function saveDemo(cases: DiagnosticResult[]) { write(LS.demo, cases); }
export function resetDemo() { localStorage.removeItem(LS.demo); localStorage.removeItem(LS.meta); }

/* ——— Mode detection ——— */
export type Mode = 'live' | 'demo';
let mode: Mode = 'demo';
export const getMode = () => mode;

export async function detectMode(): Promise<Mode> {
  const s = getSettings();
  if (s.forceDemo) return (mode = 'demo');
  try {
    await axios.get(`${s.apiUrl}/health`, { timeout: 1500 });
    mode = 'live';
  } catch {
    mode = 'demo';
  }
  return mode;
}

const http = () => axios.create({ baseURL: getSettings().apiUrl, timeout: 120000 });

/* ——— Images ——— */
export function scanImageUrl(c: DiagnosticResult): { src: string; burnedOverlay: boolean } {
  if (c.metadata?.source === 'demo') {
    const boxes = c.findings.filter(f => f.box).map(f => f.box as Box);
    return { src: scanDataUrl(c.modality, c.metadata.seed ?? 1, boxes), burnedOverlay: false };
  }
  return { src: `${getSettings().apiUrl}/overlay/${c.case_id}`, burnedOverlay: true };
}

/* ——— Pipeline stages, shared by the upload UI ——— */
export const PIPELINE_STAGES = [
  { key: 'pre', label: 'Preprocess', detail: 'Decode, normalise to 512², strip PHI tags' },
  { key: 'mod', label: 'Detect modality', detail: 'Histogram + aspect heuristics' },
  { key: 'vis', label: 'Vision inference', detail: 'YOLOv11 detector / MONAI U-Net' },
  { key: 'cal', label: 'Calibrate', detail: 'Platt scaling, k = 8' },
  { key: 'kg', label: 'Build graph', detail: 'Finding → disease → action' },
  { key: 'rep', label: 'Grounded report', detail: 'Templated, no free generation' },
] as const;

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function guessModality(file: File): Modality {
  const n = file.name.toLowerCase();
  if (/brain|mri|flair|t1|t2|\.nii/.test(n)) return 'brain_mri';
  return 'chest_xray';
}

export const apiService = {
  async analyzeScan(file: File, patientId: string, modalityOverride?: string, onStage?: (i: number) => void): Promise<DiagnosticResult> {
    if (mode === 'live') {
      onStage?.(0);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('patient_id', patientId);
      if (modalityOverride) formData.append('modality_override', modalityOverride);
      let i = 0;
      const t = setInterval(() => { i = Math.min(i + 1, PIPELINE_STAGES.length - 1); onStage?.(i); }, 700);
      try {
        const res = await http().post<DiagnosticResult>('/analyze', formData);
        const c = { ...res.data, metadata: { ...res.data.metadata, created_at: res.data.metadata.created_at ?? new Date().toISOString() } };
        putMeta(c.case_id, m => ({ ...m, audit: [{ at: new Date().toISOString(), actor: 'pipeline', action: 'Study ingested', detail: `${c.findings.length} finding(s), ${c.severity}` }, ...m.audit] }));
        return c;
      } finally { clearInterval(t); onStage?.(PIPELINE_STAGES.length); }
    }

    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    let seed = hashString(`${file.name}:${file.size}`);
    for (let i = 0; i < head.length; i += 7) seed = Math.imul(seed ^ head[i], 16777619) >>> 0;
    const modality = (modalityOverride as Modality) || guessModality(file);
    for (let i = 0; i < PIPELINE_STAGES.length; i++) { onStage?.(i); await wait(380 + (i === 2 ? 700 : 0)); }
    onStage?.(PIPELINE_STAGES.length);
    const c = assembleCase({
      caseId: uuid(), modality, patientId, seed: seed % 100000,
      findings: simulateVision(modality, seed), createdAt: new Date().toISOString(), filename: file.name,
    });
    saveDemo([c, ...demoCases()]);
    putMeta(c.case_id, m => ({ ...m, audit: [{ at: c.metadata.created_at, actor: 'pipeline', action: 'Study ingested', detail: `${c.findings.length} finding(s), ${c.severity}` }] }));
    return c;
  },

  async runSample(modality: Modality, patientId: string, onStage?: (i: number) => void): Promise<DiagnosticResult> {
    const seed = Math.floor(Math.random() * 90000) + 1000;
    for (let i = 0; i < PIPELINE_STAGES.length; i++) { onStage?.(i); await wait(320 + (i === 2 ? 600 : 0)); }
    onStage?.(PIPELINE_STAGES.length);
    const c = assembleCase({
      caseId: uuid(), modality, patientId, seed,
      findings: simulateVision(modality, seed, Math.random() < 0.15 ? 0 : 1 + Math.round(Math.random())),
      createdAt: new Date().toISOString(), filename: `sample_${modality}_${seed}.${modality === 'chest_xray' ? 'png' : 'nii.gz'}`,
    });
    saveDemo([c, ...demoCases()]);
    putMeta(c.case_id, m => ({ ...m, audit: [{ at: c.metadata.created_at, actor: 'pipeline', action: 'Study ingested', detail: `Sample · ${c.findings.length} finding(s), ${c.severity}` }] }));
    return c;
  },

  async getCase(caseId: string): Promise<DiagnosticResult> {
    const local = demoCases().find(c => c.case_id === caseId);
    if (local) return local;
    const res = await http().get<DiagnosticResult>(`/case/${caseId}`);
    return res.data;
  },

  async getHistory(): Promise<DiagnosticResult[]> {
    if (mode === 'live') {
      try {
        const res = await http().get<DiagnosticResult[]>('/history');
        return res.data;
      } catch { /* fall through to demo */ }
    }
    return demoCases();
  },

  async updateReport(caseId: string, editedReport: Report, doctorNotes?: string): Promise<DiagnosticResult> {
    let updated: DiagnosticResult;
    const cases = demoCases();
    const idx = cases.findIndex(c => c.case_id === caseId);
    if (idx >= 0) {
      updated = { ...cases[idx], report: editedReport };
      cases[idx] = updated;
      saveDemo(cases);
    } else {
      const res = await http().patch<DiagnosticResult>(`/report/${caseId}`, { edited_report: editedReport, doctor_notes: doctorNotes || null });
      updated = res.data;
    }
    putMeta(caseId, m => ({
      ...m,
      status: m.status === 'signed' ? 'in_review' : m.status,
      signedAt: undefined, signedBy: undefined,
      versions: [{ at: new Date().toISOString(), report: editedReport, note: doctorNotes }, ...m.versions],
    }));
    logAudit(caseId, 'Report revised', doctorNotes || undefined);
    return updated;
  },

  async getModels(): Promise<any> { return (await http().get('/models')).data; },
  async getHealth(): Promise<{ status: string }> { return (await http().get('/health')).data; },
};
