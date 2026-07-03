import argparse
import os
import glob
import numpy as np
import cv2
import torch
from torch.utils.data import Dataset, DataLoader, random_split
from monai.networks.nets import UNet
from monai.losses import DiceLoss

class BrainMriDataset(Dataset):
    """
    Standard PyTorch dataset loading grayscale brain MRI axial slices 
    and corresponding binary segmentation masks.
    """
    def __init__(self, images_dir: str, masks_dir: str, target_size: int = 512) -> None:
        self.target_size = target_size
        self.image_paths = sorted(glob.glob(os.path.join(images_dir, "*.*")))
        self.mask_paths = sorted(glob.glob(os.path.join(masks_dir, "*.*")))
        
        if len(self.image_paths) != len(self.mask_paths):
            raise ValueError(
                f"Mismatch: Found {len(self.image_paths)} images and {len(self.mask_paths)} masks."
            )

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        # Read image in grayscale
        img = cv2.imread(self.image_paths[idx], cv2.IMREAD_GRAYSCALE)
        mask = cv2.imread(self.mask_paths[idx], cv2.IMREAD_GRAYSCALE)
        
        # Resize to standardized dimensions
        img = cv2.resize(img, (self.target_size, self.target_size))
        mask = cv2.resize(mask, (self.target_size, self.target_size))
        
        # Normalize pixel values
        img_arr = img.astype(np.float32) / 255.0
        mask_arr = (mask > 127).astype(np.float32)  # Binary mask conversion
        
        # Convert to channels-first tensors [channel, height, width]
        img_tensor = torch.from_numpy(img_arr).unsqueeze(0)
        mask_tensor = torch.from_numpy(mask_arr).unsqueeze(0)
        
        return img_tensor, mask_tensor

def parse_args() -> argparse.Namespace:
    """Parses command line inputs for U-Net segmentation training."""
    parser = argparse.ArgumentParser(description="MedGraph AI - MONAI U-Net MRI Training Pipeline")
    parser.add_argument("--images", type=str, required=True, help="Path to images directory")
    parser.add_argument("--masks", type=str, required=True, help="Path to masks directory")
    parser.add_argument("--epochs", type=int, default=50, help="Number of epochs (default: 50)")
    parser.add_argument("--batch", type=int, default=16, help="Batch size (default: 16)")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate (default: 1e-4)")
    parser.add_argument(
        "--output", 
        type=str, 
        default="models/brain_unet.pt", 
        help="Best weights destination (default: models/brain_unet.pt)"
    )
    return parser.parse_args()

def train_epoch(model, loader, optimizer, criterion, device) -> float:
    """Executes single training epoch over batch loaders."""
    model.train()
    epoch_loss = 0.0
    for images, masks in loader:
        images, masks = images.to(device), masks.to(device)
        
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, masks)
        loss.backward()
        optimizer.step()
        
        epoch_loss += loss.item() * images.size(0)
    return epoch_loss / len(loader.dataset)

def validate(model, loader, criterion, device) -> tuple[float, float]:
    """Evaluates validation loss and Dice metric metrics."""
    model.eval()
    val_loss = 0.0
    total_dice = 0.0
    dice_metric = DiceLoss(sigmoid=True, reduction="mean")
    
    with torch.no_grad():
        for images, masks in loader:
            images, masks = images.to(device), masks.to(device)
            outputs = model(images)
            loss = criterion(outputs, masks)
            val_loss += loss.item() * images.size(0)
            
            # Dice metric evaluation
            dice_loss = dice_metric(outputs, masks)
            total_dice += (1.0 - dice_loss.item()) * images.size(0)
            
    return val_loss / len(loader.dataset), total_dice / len(loader.dataset)

def main() -> None:
    args = parse_args()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training initialized on processor device: {device}")

    # 1. Prepare data loaders
    dataset = BrainMriDataset(args.images, args.masks)
    val_size = int(len(dataset) * 0.2)
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch, shuffle=False)

    # 2. Configure MONAI UNet model
    model = UNet(
        spatial_dims=2,
        in_channels=1,
        out_channels=1,
        channels=(16, 32, 64, 128),
        strides=(2, 2, 2),
        num_res_units=2
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)
    criterion = DiceLoss(sigmoid=True)  # Optimize overlap dice metrics directly

    # 3. Training Loop
    best_dice = 0.0
    for epoch in range(args.epochs):
        train_loss = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_dice = validate(model, val_loader, criterion, device)
        
        print(
            f"Epoch {epoch + 1}/{args.epochs} - "
            f"Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val Dice: {val_dice:.4f}"
        )
        
        # Save best model checkpoint
        if val_dice > best_dice:
            best_dice = val_dice
            os.makedirs(os.path.dirname(args.output), exist_ok=True)
            torch.save(model.state_dict(), args.output)
            print(f"--> Saved best checkpoint to: {args.output} (Dice: {best_dice:.4f})")

    print(f"Training process finished. Best validation Dice coefficient: {best_dice:.4f}")

if __name__ == "__main__":
    main()
