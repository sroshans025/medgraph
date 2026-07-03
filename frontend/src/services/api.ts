import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

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

export interface GraphNode {
  id: string;
  label: string;
  type: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

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

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const apiService = {
  /**
   * Uploads scan file with metadata for dynamic diagnostic analysis.
   */
  analyzeScan: async (
    file: File,
    patientId: string,
    modalityOverride?: string
  ): Promise<DiagnosticResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('patient_id', patientId);
    if (modalityOverride) {
      formData.append('modality_override', modalityOverride);
    }

    const response = await api.post<DiagnosticResult>('/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Retrieves case diagnostic details by UUID.
   */
  getCase: async (caseId: string): Promise<DiagnosticResult> => {
    const response = await api.get<DiagnosticResult>(`/case/${caseId}`);
    return response.data;
  },

  /**
   * Retrieves full chronological timeline history of cases.
   */
  getHistory: async (): Promise<DiagnosticResult[]> => {
    const response = await api.get<DiagnosticResult[]>('/history');
    return response.data;
  },

  /**
   * Submits physician-reviewed report edits to update the active version.
   */
  updateReport: async (
    caseId: string,
    editedReport: Report,
    doctorNotes?: string
  ): Promise<DiagnosticResult> => {
    const response = await api.patch<DiagnosticResult>(`/report/${caseId}`, {
      edited_report: editedReport,
      doctor_notes: doctorNotes || null,
    });
    return response.data;
  },

  /**
   * Fetches active clinical AI models registry information.
   */
  getModels: async (): Promise<any> => {
    const response = await api.get('/models');
    return response.data;
  },

  /**
   * Confirms API pipeline microservice readiness.
   */
  getHealth: async (): Promise<{ status: string }> => {
    const response = await api.get<{ status: string }>('/health');
    return response.data;
  },
};
