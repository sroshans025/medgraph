from typing import List, Dict, Any

class SeverityEngine:
    """
    Grades clinical scan severity level (Minimal, Mild, Moderate, Severe, Critical)
    based on the characteristics, quantity, and probabilities of extracted findings.
    """

    def determine_severity(self, findings: List[Dict[str, Any]]) -> str:
        """
        Calculates overall case-level severity.
        
        Args:
            findings: List of dictionary findings extracted from the scan.
            
        Returns:
            A string representing severity: 'Minimal', 'Mild', 'Moderate', 'Severe', 'Critical'.
        """
        if not findings:
            return "Minimal"

        # Count severity tags and identify highly confident findings
        num_severe = sum(1 for f in findings if f.get("severity") == "Severe")
        max_prob = max(f.get("probability", 0.0) for f in findings)
        
        # 1. Critical cases: Multiple severe findings, or severe finding with extreme confidence
        if num_severe > 1 or (num_severe == 1 and max_prob >= 0.95):
            return "Critical"
            
        # 2. Severe cases: Single severe finding with confidence >= 0.80
        if num_severe >= 1 and max_prob >= 0.80:
            return "Severe"
            
        # 3. Moderate cases: Any finding with confidence >= 0.60
        if max_prob >= 0.60:
            return "Moderate"
            
        # 4. Mild cases: Any finding with confidence >= 0.25
        if max_prob >= 0.25:
            return "Mild"
            
        # 5. Minimal cases: All findings are below threshold
        return "Minimal"
