from backend.services.models.reasoning.knowledge_graph.builder import ClinicalKnowledgeGraphBuilder

def test_knowledge_graph_unremarkable_chest() -> None:
    """Tests knowledge graph when chest scan is unremarkable (no findings)."""
    builder = ClinicalKnowledgeGraphBuilder()
    kg = builder.build_graph([], "chest_xray")
    
    assert len(kg.nodes) == 2
    assert len(kg.edges) == 1
    
    node_ids = {node.id for node in kg.nodes}
    assert "disease_normal" in node_ids
    assert "rec_routine" in node_ids

def test_knowledge_graph_chest_moderate() -> None:
    """Tests knowledge graph for moderate chest xray opacity."""
    builder = ClinicalKnowledgeGraphBuilder()
    findings = [{
        "name": "Opacity",
        "location": "Right Lower Lobe",
        "probability": 0.92,
        "severity": "Moderate",
        "evidence": "Consolidation Pattern"
    }]
    
    kg = builder.build_graph(findings, "chest_xray")
    node_ids = {node.id for node in kg.nodes}
    
    assert "finding_0" in node_ids
    assert "disease_pneumonia" in node_ids
    assert "severity_moderate" in node_ids
    assert "rec_antibiotics" in node_ids
    assert "rec_followup" in node_ids
    
    edge_tuples = {(edge.source, edge.target, edge.relation) for edge in kg.edges}
    assert ("finding_0", "disease_pneumonia", "SUGGESTS") in edge_tuples
    assert ("disease_pneumonia", "severity_moderate", "HAS_SEVERITY") in edge_tuples
    assert ("disease_pneumonia", "rec_antibiotics", "REQUIRES") in edge_tuples

def test_knowledge_graph_brain_severe() -> None:
    """Tests knowledge graph for severe brain MRI hyperintensity."""
    builder = ClinicalKnowledgeGraphBuilder()
    findings = [{
        "name": "Hyperintensity",
        "location": "Left Frontal Lobe",
        "probability": 0.88,
        "severity": "Severe",
        "evidence": "T2/FLAIR Hyperintensity"
    }]
    
    kg = builder.build_graph(findings, "brain_mri")
    node_ids = {node.id for node in kg.nodes}
    
    assert "finding_0" in node_ids
    assert "disease_lesion" in node_ids
    assert "severity_severe" in node_ids
    assert "rec_contrast" in node_ids
    assert "rec_neuro_urgent" in node_ids
    
    edge_tuples = {(edge.source, edge.target, edge.relation) for edge in kg.edges}
    assert ("finding_0", "disease_lesion", "SUGGESTS") in edge_tuples
    assert ("disease_lesion", "severity_severe", "HAS_SEVERITY") in edge_tuples
    assert ("disease_lesion", "rec_neuro_urgent", "REQUIRES") in edge_tuples
