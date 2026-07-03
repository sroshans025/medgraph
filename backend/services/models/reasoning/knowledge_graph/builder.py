from typing import List, Dict, Any, Tuple
import networkx as nx

from backend.api.schemas.schemas import GraphSchema, GraphNode, GraphEdge

class ClinicalKnowledgeGraphBuilder:
    """
    Constructs directed clinical reasoning graphs using NetworkX mapping 
    extracted scan findings to potential diseases, severity, and recommendations.
    """

    def build_graph(self, findings: List[Dict[str, Any]], modality: str) -> GraphSchema:
        """
        Builds a NetworkX directed graph from structured findings and maps it to GraphSchema.
        
        Args:
            findings: List of structured findings extracted from vision models.
            modality: Scan modality ('chest_xray' or 'brain_mri').
            
        Returns:
            A serialized GraphSchema representation of the clinical knowledge graph.
        """
        G = nx.DiGraph()

        if modality == "chest_xray":
            self._build_chest_xray_subgraph(G, findings)
        elif modality == "brain_mri":
            self._build_brain_mri_subgraph(G, findings)
        else:
            # Fallback for unknown modality (add general error node)
            G.add_node(
                "unknown_modality",
                label="Unclassified Scan Modality",
                type="Disease"
            )

        return self._serialize_graph(G)

    def _build_chest_xray_subgraph(self, G: nx.DiGraph, findings: List[Dict[str, Any]]) -> None:
        """Populates directed graph nodes and edges for Chest X-Ray findings."""
        if not findings:
            G.add_node("disease_normal", label="Unremarkable Chest Scan", type="Disease")
            G.add_node("rec_routine", label="Routine follow-up", type="Recommendation")
            G.add_edge("disease_normal", "rec_routine", relation="REQUIRES")
            return

        for idx, f in enumerate(findings):
            name = f.get("name", "Finding")
            loc = f.get("location", "Lung Field")
            sev = f.get("severity", "Moderate")
            
            finding_id = f"finding_{idx}"
            finding_label = f"{loc} {name}"
            G.add_node(finding_id, label=finding_label, type="Finding")
            
            disease_id = "disease_pneumonia"
            G.add_node(disease_id, label="Pneumonia", type="Disease")
            G.add_edge(finding_id, disease_id, relation="SUGGESTS")
            
            severity_id = f"severity_{sev.lower()}"
            G.add_node(severity_id, label=f"{sev} Severity", type="Severity")
            G.add_edge(disease_id, severity_id, relation="HAS_SEVERITY")
            
            # Recommendation paths based on severity
            if sev == "Severe":
                recs = [
                    ("rec_hospital", "Inpatient Hospitalization & IV Antibiotics"),
                    ("rec_ct", "Urgent Chest CT Scan")
                ]
            else:
                recs = [
                    ("rec_antibiotics", "Broad-Spectrum Antibiotic Therapy"),
                    ("rec_followup", "Follow-up Chest X-ray in 4-6 weeks")
                ]
                
            for rec_id, rec_label in recs:
                G.add_node(rec_id, label=rec_label, type="Recommendation")
                G.add_edge(disease_id, rec_id, relation="REQUIRES")

    def _build_brain_mri_subgraph(self, G: nx.DiGraph, findings: List[Dict[str, Any]]) -> None:
        """Populates directed graph nodes and edges for Brain MRI findings."""
        if not findings:
            G.add_node("disease_normal", label="Unremarkable Brain Scan", type="Disease")
            G.add_node("rec_routine", label="Routine clinical follow-up", type="Recommendation")
            G.add_edge("disease_normal", "rec_routine", relation="REQUIRES")
            return

        for idx, f in enumerate(findings):
            name = f.get("name", "Finding")
            loc = f.get("location", "Cerebral Hemisphere")
            sev = f.get("severity", "Severe")
            
            finding_id = f"finding_{idx}"
            finding_label = f"{loc} {name}"
            G.add_node(finding_id, label=finding_label, type="Finding")
            
            # Determine specific disease mapping from classifier finding name
            if "glioma" in name.lower():
                disease_id = "disease_glioma"
                disease_label = "Glioma Tumor"
                recs = [
                    ("rec_contrast", "Brain MRI with Contrast"),
                    ("rec_neurosurg_biopsy", "Neurosurgical consultation for biopsy/resection"),
                    ("rec_rad_onc", "Radiation oncology review")
                ]
            elif "meningioma" in name.lower():
                disease_id = "disease_meningioma"
                disease_label = "Meningioma"
                recs = [
                    ("rec_neurosurg_consult", "Neurosurgical consultation"),
                    ("rec_surveillance", "Annual surveillance brain MRI")
                ]
            elif "pituitary" in name.lower():
                disease_id = "disease_pituitary"
                disease_label = "Pituitary Adenoma"
                recs = [
                    ("rec_endocrine", "Endocrinological workup (hormonal panels)"),
                    ("rec_visual", "Visual field testing"),
                    ("rec_sella", "Dedicated Brain MRI of Sella Turcica")
                ]
            else:
                disease_id = "disease_lesion"
                disease_label = "Demyelinating Lesion"
                if sev == "Severe":
                    recs = [
                        ("rec_contrast", "Brain MRI with Gadolinium Contrast"),
                        ("rec_neuro_urgent", "Urgent Inpatient Neurology Consultation")
                    ]
                else:
                    recs = [
                        ("rec_contrast", "Brain MRI with Gadolinium Contrast"),
                        ("rec_neuro_refer", "Outpatient Neurology Referral")
                    ]

            G.add_node(disease_id, label=disease_label, type="Disease")
            G.add_edge(finding_id, disease_id, relation="SUGGESTS")
            
            severity_id = f"severity_{sev.lower()}"
            G.add_node(severity_id, label=f"{sev} Severity", type="Severity")
            G.add_edge(disease_id, severity_id, relation="HAS_SEVERITY")
            
            for rec_id, rec_label in recs:
                G.add_node(rec_id, label=rec_label, type="Recommendation")
                G.add_edge(disease_id, rec_id, relation="REQUIRES")

    def _serialize_graph(self, G: nx.DiGraph) -> GraphSchema:
        """Converts NetworkX DiGraph object to a serializable GraphSchema."""
        nodes = []
        for node_id, data in G.nodes(data=True):
            nodes.append(GraphNode(
                id=node_id,
                label=data.get("label", str(node_id)),
                type=data.get("type", "Node")
            ))
            
        edges = []
        for u, v, data in G.edges(data=True):
            edges.append(GraphEdge(
                source=u,
                target=v,
                relation=data.get("relation", "CONNECTS")
            ))
            
        return GraphSchema(nodes=nodes, edges=edges)
