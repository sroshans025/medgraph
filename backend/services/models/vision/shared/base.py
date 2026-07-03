from abc import ABC, abstractmethod
from typing import List, Dict, Any
import numpy as np

class MedicalVisionModel(ABC):
    """
    Abstract base class defining the common interface for computer vision 
    models in the MedGraph AI diagnostic pipeline.
    """

    @abstractmethod
    def predict(self, preprocessed_image: np.ndarray, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Executes vision model inference on a preprocessed scan.
        
        Args:
            preprocessed_image: 2D normalized float32 numpy array.
            metadata: Clinical scanner metadata dictionary.
            
        Returns:
            A list of dictionary findings, where each finding contains:
                - name: finding name (e.g. Opacity, Hyperintensity)
                - location: anatomical location
                - probability: float (0.0 to 1.0)
                - severity: local severity rating
                - evidence: visual pattern type
                - box: bounding box coordinates [x_min, y_min, x_max, y_max] or contour points
        """
        pass
