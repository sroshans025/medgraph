import argparse
import os
import glob
import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, random_split

class BrainClassifier(nn.Module):
    """
    Lightweight convolutional neural network for 4-class brain MRI classification:
    Classes: 0: glioma, 1: meningioma, 2: notumor, 3: pituitary
    """
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2, 2), # 256 -> 128
            
            nn.Conv2d(16, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2, 2), # 128 -> 64
            
            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((7, 7))
        )
        self.classifier = nn.Sequential(
            nn.Linear(64 * 7 * 7, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 4)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = torch.flatten(x, 1)
        return self.classifier(x)

class BrainClassificationDataset(Dataset):
    """
    Dataset loading raw image files from class directories:
    glioma, meningioma, notumor, pituitary.
    """
    def __init__(self, data_dir: str, target_size: int = 256) -> None:
        self.target_size = target_size
        self.classes = ["glioma", "meningioma", "notumor", "pituitary"]
        self.samples = []
        
        for class_idx, class_name in enumerate(self.classes):
            class_path = os.path.join(data_dir, class_name)
            if not os.path.exists(class_path):
                continue
            file_paths = glob.glob(os.path.join(class_path, "*.*"))
            for path in file_paths:
                self.samples.append((path, class_idx))
                
        if not self.samples:
            raise ValueError(f"No image samples found in dataset directory: {data_dir}")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        path, label = self.samples[idx]
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        
        # Resize and normalize
        img = cv2.resize(img, (self.target_size, self.target_size))
        img_arr = img.astype(np.float32) / 255.0
        
        img_tensor = torch.from_numpy(img_arr).unsqueeze(0) # [1, H, W]
        return img_tensor, label

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MedGraph AI - Brain MRI Classification Training")
    parser.add_argument("--data_dir", type=str, default="training/datasets", help="Path to datasets folder")
    parser.add_argument("--epochs", type=int, default=5, help="Number of epochs to train")
    parser.add_argument("--batch", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--output", type=str, default="models/brain_classifier.pt", help="Output weights file path")
    return parser.parse_args()

def train(model, loader, optimizer, criterion, device) -> float:
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0
    
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        correct += predicted.eq(labels).sum().item()
        total += labels.size(0)
        
    return total_loss / total, correct / total

def validate(model, loader, criterion, device) -> tuple[float, float]:
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)
            
            total_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)
            
    return total_loss / total, correct / total

def main() -> None:
    args = parse_args()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Initializing classifier training on device: {device}")

    # 1. Hydrate loaders
    dataset = BrainClassificationDataset(args.data_dir)
    val_size = int(len(dataset) * 0.2)
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch, shuffle=False)
    
    print(f"Dataset summary: {len(dataset)} samples. Training size: {train_size}. Validation size: {val_size}")

    # 2. Build model
    model = BrainClassifier().to(device)
    optimizer = optim.AdamW(model.parameters(), lr=args.lr)
    criterion = nn.CrossEntropyLoss()

    best_acc = 0.0
    for epoch in range(args.epochs):
        train_loss, train_acc = train(model, train_loader, optimizer, criterion, device)
        val_loss, val_acc = validate(model, val_loader, criterion, device)
        
        print(
            f"Epoch {epoch+1}/{args.epochs} - "
            f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:.2f}% | "
            f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc*100:.2f}%"
        )
        
        if val_acc > best_acc:
            best_acc = val_acc
            os.makedirs(os.path.dirname(args.output), exist_ok=True)
            torch.save(model.state_dict(), args.output)
            print(f"--> Saved best checkpoint to: {args.output} (Accuracy: {best_acc*100:.2f}%)")

    print(f"Training complete. Best validation accuracy: {best_acc*100:.2f}%")

if __name__ == "__main__":
    main()
