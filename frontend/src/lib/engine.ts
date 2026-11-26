/**
 * Client-side port of the MedGraph reasoning pipeline.
 *
 * Mirrors backend/services/models/reasoning/* so the hosted preview behaves
 * like the real service when no API is reachable: same location heuristics,
 * severity grading, Platt calibration (k=8, midpoint=.5), graph rules and
 * grounded report text. Vision output is simulated deterministically from a
 * seed (file hash or sample id) so the same input always gives the same case.
 */
import type {
  DiagnosticResult, Finding, Evidence, Confidence, KnowledgeGraph, Report, GraphNode, GraphEdge,
} from '../services/api';
import type { Box } from './scanArt';

export type Modality = 'chest_xray' | 'brain_mri';

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function uuid(seed?: number): string {
  const r = seed !== undefined ? rng(seed) : Math.random;
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(r() * 4)]}${hex(3)}-${hex(12)}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function lungLocation(x: number, y: number) {
  const h = x < 256 ? 'Right' : 'Left';
  const v = y < 170 ? 'Upper Lobe' : y < 340 ? 'Middle Lobe' : 'Lower Lobe';
  return `${h} ${v}`;
}
function brainLocation(x: number, y: number) {
  const h = x < 256 ? 'Right' : 'Left';
  const v = y < 200 ? 'Frontal' : y < 340 ? 'Temporal' : 'Occipital';
  return `${h} ${v} Lobe`;
}

/* ——— Simulated vision stage ——— */
export function simulateVision(modality: Modality, seed: number, forceFindings?: number): Finding[] {
  const r = rng(seed);
  const count = forceFindings ?? (r() < 0.18 ? 0 : r() < 0.7 ? 1 : 2);
  const out: Finding[] = [];
  for (let i = 0; i < count; i++) {
    if (modality === 'chest_xray') {
      const right = r() < 0.6;
      const cx = right ? 160 + r() * 50 : 330 + r() * 50;
      const cy = 200 + r() * 180;
      const w = 50 + r() * 50, h = 40 + r() * 45;
      const box: Box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2].map(Math.round) as Box;
      const prob = round2(0.55 + r() * 0.43);
      const label = r() < 0.75 ? 'Opacity' : 'Nodule';
      out.push({
        name: label, location: lungLocation(cx, cy), probability: prob,
        severity: prob >= 0.85 ? 'Severe' : prob >= 0.65 ? 'Moderate' : 'Mild',
        evidence: label === 'Opacity' ? 'Consolidation Pattern' : 'Visual Feature', box,
      });
    } else {
      const left = r() < 0.5;
      const cx = left ? 300 + r() * 60 : 150 + r() * 60;
      const cy = 160 + r() * 200;
      const w = 34 + r() * 40, h = 30 + r() * 40;
      const box: Box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2].map(Math.round) as Box;
      const prob = round2(0.6 + r() * 0.38);
      const cls = ['glioma', 'meningioma', 'pituitary', 'lesion'][Math.floor(r() * 4)];
      if (cls === 'pituitary') {
        // Sellar lesions sit on the midline, just below the third ventricle.
        const pw = 22 + r() * 14, ph = 18 + r() * 12, py = 372;
        box[0] = Math.round(256 - pw / 2); box[2] = Math.round(256 + pw / 2);
        box[1] = Math.round(py - ph / 2); box[3] = Math.round(py + ph / 2);
      }
      const name = cls === 'lesion' ? 'Hyperintensity' : `${cls[0].toUpperCase()}${cls.slice(1)} Tumor`;
      out.push({
        name, location: cls === 'pituitary' ? 'Sellar / Suprasellar Region' : brainLocation(cx, cy), probability: prob,
        severity: cls === 'lesion' ? (prob >= 0.85 ? 'Severe' : 'Moderate') : 'Severe',
        evidence: cls === 'lesion' ? 'T2/FLAIR Hyperintense Lesion' : `T2/FLAIR Hyperintensity indicative of ${cls[0].toUpperCase()}${cls.slice(1)}`,
        box,
      });
    }
  }
  return out;
}

/* ——— Severity engine ——— */
export function gradeSeverity(findings: Finding[]): string {
  if (!findings.length) return 'Minimal';
  const nSevere = findings.filter(f => f.severity === 'Severe').length;
  const maxP = Math.max(...findings.map(f => f.probability));
  if (nSevere > 1 || (nSevere === 1 && maxP >= 0.95)) return 'Critical';
  if (nSevere >= 1 && maxP >= 0.8) return 'Severe';
  if (maxP >= 0.6) return 'Moderate';
  if (maxP >= 0.25) return 'Mild';
  return 'Minimal';
}

/* ——— Platt calibration ——— */
export const platt = (p: number, k = 8, mid = 0.5) => 1 / (1 + Math.exp(-k * (p - mid)));

export function calibrate(findings: Finding[]): Confidence {
  if (!findings.length) {
    return { confidence_score: 0, confidence_band: 'Uncalibrated', evidence_score: 0, model_stability: 0, prediction_reliability: 0 };
  }
  const probs = findings.map(f => f.probability);
  const raw = Math.max(...probs);
  const rel = Math.min(0.99, Math.max(0.01, platt(raw)));
  const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
  const std = Math.sqrt(probs.reduce((a, b) => a + (b - mean) ** 2, 0) / probs.length);
  const stability = probs.length > 1 ? Math.min(1, Math.max(0.1, 1 - std)) : 0.95;
  const band = rel >= 0.85 ? 'High Confidence' : rel >= 0.6 ? 'Moderate Confidence' : rel >= 0.25 ? 'Low Confidence' : 'Uncalibrated';
  return { confidence_score: round2(raw), confidence_band: band, evidence_score: round2(mean), model_stability: round2(stability), prediction_reliability: round2(rel) };
}

/* ——— Knowledge graph ——— */
export function buildGraph(findings: Finding[], modality: Modality): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const node = (id: string, label: string, type: string) => { if (!nodes.has(id)) nodes.set(id, { id, label, type }); };
  const edge = (source: string, target: string, relation: string) => {
    const k = `${source}>${target}`;
    if (!edgeKeys.has(k)) { edgeKeys.add(k); edges.push({ source, target, relation }); }
  };

  if (!findings.length) {
    node('disease_normal', modality === 'chest_xray' ? 'Unremarkable Chest Scan' : 'Unremarkable Brain Scan', 'Disease');
    node('rec_routine', modality === 'chest_xray' ? 'Routine follow-up' : 'Routine clinical follow-up', 'Recommendation');
    edge('disease_normal', 'rec_routine', 'REQUIRES');
    return { nodes: [...nodes.values()], edges };
  }

  findings.forEach((f, idx) => {
    const fid = `finding_${idx}`;
    node(fid, `${f.location} ${f.name}`, 'Finding');
    let did: string, dlabel: string, recs: [string, string][];
    if (modality === 'chest_xray') {
      did = 'disease_pneumonia'; dlabel = 'Pneumonia';
      recs = f.severity === 'Severe'
        ? [['rec_hospital', 'Inpatient Hospitalization & IV Antibiotics'], ['rec_ct', 'Urgent Chest CT Scan']]
        : [['rec_antibiotics', 'Broad-Spectrum Antibiotic Therapy'], ['rec_followup', 'Follow-up Chest X-ray in 4-6 weeks']];
    } else {
      const n = f.name.toLowerCase();
      if (n.includes('glioma')) {
        did = 'disease_glioma'; dlabel = 'Glioma Tumor';
        recs = [['rec_contrast', 'Brain MRI with Contrast'], ['rec_neurosurg_biopsy', 'Neurosurgical consultation for biopsy/resection'], ['rec_rad_onc', 'Radiation oncology review']];
      } else if (n.includes('meningioma')) {
        did = 'disease_meningioma'; dlabel = 'Meningioma';
        recs = [['rec_neurosurg_consult', 'Neurosurgical consultation'], ['rec_surveillance', 'Annual surveillance brain MRI']];
      } else if (n.includes('pituitary')) {
        did = 'disease_pituitary'; dlabel = 'Pituitary Adenoma';
        recs = [['rec_endocrine', 'Endocrinological workup (hormonal panels)'], ['rec_visual', 'Visual field testing'], ['rec_sella', 'Dedicated Brain MRI of Sella Turcica']];
      } else {
        did = 'disease_lesion'; dlabel = 'Demyelinating Lesion';
        recs = f.severity === 'Severe'
          ? [['rec_contrast', 'Brain MRI with Gadolinium Contrast'], ['rec_neuro_urgent', 'Urgent Inpatient Neurology Consultation']]
          : [['rec_contrast', 'Brain MRI with Gadolinium Contrast'], ['rec_neuro_refer', 'Outpatient Neurology Referral']];
      }
    }
    node(did, dlabel, 'Disease');
    edge(fid, did, 'SUGGESTS');
    const sid = `severity_${f.severity.toLowerCase()}`;
    node(sid, `${f.severity} Severity`, 'Severity');
    edge(did, sid, 'HAS_SEVERITY');
    recs.forEach(([rid, rl]) => { node(rid, rl, 'Recommendation'); edge(did, rid, 'REQUIRES'); });
  });
  return { nodes: [...nodes.values()], edges };
}

/* ——— Grounded reasoning + report ——— */
function reason(findings: Finding[], severity: string, c: Confidence, modality: Modality): string {
  if (!findings.length) {
    return `No focal abnormalities were detected by the ${modality === 'chest_xray' ? 'chest radiograph detector' : 'MRI segmentation model'}. The study is graded ${severity} severity. No clinical inference is drawn beyond the absence of model findings.`;
  }
  const parts = findings.map((f, i) =>
    `Finding ${i + 1}: A focal area of ${f.name.toLowerCase()} is identified in the ${f.location.toLowerCase()} with a model probability of ${Math.round(f.probability * 100)}%. This finding demonstrates a ${f.evidence.toLowerCase()} pattern of ${f.severity.toLowerCase()} severity.`);
  const sev = `Case-level severity is graded ${severity} based on ${findings.filter(f => f.severity === 'Severe').length} severe-class finding(s) and a peak probability of ${Math.max(...findings.map(f => f.probability)).toFixed(2)}.`;
  const cal = `Model predictions are calibrated as ${c.confidence_band} (Platt reliability score: ${c.prediction_reliability}, evidence alignment score: ${c.evidence_score}, stability index: ${c.model_stability}).`;
  return `${parts.join(' ')} ${sev} ${cal}`;
}

function report(modality: Modality, findings: Finding[], severity: string, interp: string, recs: string[]): Report {
  const imaging = !findings.length
    ? 'No focal abnormality identified by the vision engine.'
    : modality === 'chest_xray'
      ? findings.map(f => `A ${f.severity.toLowerCase()} ${f.name.toLowerCase()} is visualized in the ${f.location.toLowerCase()}.`).join(' ')
      : findings.map(f => `A focal ${f.name.toLowerCase()} signal is visualized in the ${f.location.toLowerCase()}.`).join(' ');
  return {
    patient_summary: `Case processed using MedGraph AI platform. Modality: ${modality}.`,
    imaging_findings: imaging,
    evidence_summary: `Extracted ${findings.length} structured vision findings.`,
    clinical_interpretation: interp,
    severity_level: severity,
    recommendations: recs,
    limitations: 'This report is generated from automated image analysis and is limited to findings the vision models can detect. It does not incorporate patient history, labs or prior imaging and must be reviewed and signed by a qualified physician before clinical use.',
    physician_review_required: true,
  };
}

export function assembleCase(opts: {
  caseId: string; modality: Modality; patientId: string; findings: Finding[]; seed: number; createdAt: string; filename?: string;
}): DiagnosticResult {
  const { caseId, modality, patientId, findings, seed, createdAt, filename } = opts;
  const evidence: Evidence[] = findings.map(f => ({
    finding_name: f.name,
    reason: `Focal ${f.name.toLowerCase()} is identified in the ${f.location.toLowerCase()} area matching a ${f.evidence.toLowerCase()}.`,
    measurement: f.box ? `${((f.box[2] - f.box[0]) * 0.05).toFixed(1)}cm x ${((f.box[3] - f.box[1]) * 0.05).toFixed(1)}cm` : 'N/A',
    confidence: f.probability,
    supporting_region: f.box,
    visualization_path: null,
  }));
  const severity = gradeSeverity(findings);
  const confidence = calibrate(findings);
  const kg = buildGraph(findings, modality);
  const recs = kg.nodes.filter(n => n.type === 'Recommendation').map(n => n.label);
  const interp = reason(findings, severity, confidence, modality);
  return {
    case_id: caseId,
    modality,
    metadata: {
      patient_id: patientId, original_width: 512, original_height: 512, created_at: createdAt,
      seed, filename: filename ?? `${patientId}.${modality === 'chest_xray' ? 'png' : 'nii.gz'}`, source: 'demo',
    },
    findings, evidence, knowledge_graph: kg, severity, confidence,
    overlay_url: '', report: report(modality, findings, severity, interp, recs),
  };
}

/* ——— Seeded sample worklist ——— */
const SAMPLE_PATIENTS: [string, Modality, number, number][] = [
  ['PT-40921', 'chest_xray', 2, 1201], ['PT-38115', 'brain_mri', 1, 2203], ['PT-41007', 'chest_xray', 1, 3307],
  ['PT-39642', 'brain_mri', 0, 4409], ['PT-40288', 'chest_xray', 0, 5501], ['PT-37750', 'brain_mri', 2, 6607],
  ['PT-41213', 'chest_xray', 1, 7703], ['PT-40056', 'brain_mri', 1, 8807], ['PT-38894', 'chest_xray', 2, 9901],
  ['PT-41390', 'chest_xray', 1, 10111], ['PT-39017', 'brain_mri', 1, 11213], ['PT-40733', 'chest_xray', 0, 12301],
];

export function seedCases(): DiagnosticResult[] {
  const now = Date.now();
  return SAMPLE_PATIENTS.map(([pid, mod, n, seed], i) =>
    assembleCase({
      caseId: uuid(seed), modality: mod, patientId: pid, seed,
      findings: simulateVision(mod, seed, n),
      createdAt: new Date(now - (i * 7 + 2) * 3600_000 - i * 913_000).toISOString(),
    }));
}

export function priorityScore(c: DiagnosticResult): number {
  const sev: Record<string, number> = { Critical: 100, Severe: 75, Moderate: 45, Mild: 20, Minimal: 5 };
  const ageH = (Date.now() - new Date(c.metadata.created_at ?? Date.now()).getTime()) / 3600_000;
  return Math.round((sev[c.severity] ?? 0) + c.confidence.confidence_score * 15 + Math.min(ageH, 48) * 0.4);
}
