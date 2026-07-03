import argparse
import os
import shutil
from ultralytics import YOLO

def parse_args() -> argparse.Namespace:
    """
    Parses command line arguments for YOLOv11 training pipeline.
    """
    parser = argparse.ArgumentParser(description="MedGraph AI - YOLOv11 Chest X-Ray Training Pipeline")
    parser.add_argument(
        "--data",
        type=str,
        required=True,
        help="Path to dataset configuration YAML file (e.g. dataset.yaml)"
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=50,
        help="Number of training epochs (default: 50)"
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=16,
        help="Training batch size (default: 16)"
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=512,
        help="Input image resolution size (default: 512)"
    )
    parser.add_argument(
        "--weights",
        type=str,
        default="yolo11n.pt",
        help="Path to initial pre-trained weights (default: yolo11n.pt)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models/chest_yolo.pt",
        help="Destination path to export best weights (default: models/chest_yolo.pt)"
    )
    return parser.parse_args()

def main() -> None:
    """
    Executes YOLOv11 model training and weights export.
    """
    args = parse_args()

    # 1. Initialize YOLO model
    print(f"Loading base YOLO weights checkpoint from: {args.weights}")
    model = YOLO(args.weights)

    # 2. Execute training process
    print(f"Starting training on dataset {args.data} for {args.epochs} epochs...")
    results = model.train(
        data=args.data,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        workers=4,
        device=0,  # Runs on CUDA GPU 0. Change/omit to train on CPU
        project="medgraph_yolo",
        name="chest_xray",
        exist_ok=True
    )

    # 3. Validate the model output
    print("Evaluating model weights on validation split...")
    metrics = model.val()
    print(f"Validation mAP50: {metrics.box.map50:.4f}")
    print(f"Validation mAP50-95: {metrics.box.map:.4f}")

    # 4. Export best weights to output directory
    best_weights_src = os.path.join("medgraph_yolo", "chest_xray", "weights", "best.pt")
    if os.path.exists(best_weights_src):
        # Ensure parent output folder exists
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        shutil.copy(best_weights_src, args.output)
        print(f"Training completed successfully. Best weights exported to: {args.output}")
    else:
        print(f"Warning: Best weights file not found at expected source path: {best_weights_src}")

if __name__ == "__main__":
    main()
