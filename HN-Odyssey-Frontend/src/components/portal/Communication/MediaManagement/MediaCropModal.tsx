import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "./MediaCropModal.css";
import type { MediaRecord } from "../../../../hooks/portal/Communication/MediaManagement/useMediaManagement";

interface MediaCropModalProps {
  isOpen: boolean;
  mediaRecord: MediaRecord | null;
  onClose: () => void;
  onSave: (id: string, newFile: File, newUrl: string) => void;
}

// Hàm tiện ích để trích xuất file ảnh từ Canvas
const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area,
  fileName: string,
): Promise<{ file: File; url: string } | null> => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;

  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"));
        return;
      }
      const file = new File([blob], fileName, { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      resolve({ file, url });
    }, "image/jpeg");
  });
};

export default function MediaCropModal({
  isOpen,
  mediaRecord,
  onClose,
  onSave,
}: MediaCropModalProps) {
  // 1. Khai báo toàn bộ Hooks ở trên cùng
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // new: Di chuyển useCallback lên TRƯỚC lệnh return để tuân thủ Rules of Hooks
  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  // 2. new: Đặt lệnh early return ở đây (SAU TẤT CẢ CÁC HOOKS)
  if (!isOpen || !mediaRecord) return null;

  const handleSaveCrop = async () => {
    if (!croppedAreaPixels) return;
    try {
      setIsProcessing(true);
      const croppedImage = await getCroppedImg(
        mediaRecord.url,
        croppedAreaPixels,
        mediaRecord.fileName,
      );
      if (croppedImage) {
        onSave(mediaRecord.id, croppedImage.file, croppedImage.url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="mm-crop-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="mm-crop-container">
        <div className="mm-crop-header">
          <h2 className="mm-crop-title">Crop Image</h2>
          <button type="button" className="mm-crop-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mm-crop-body">
          <div className="mm-crop-area">
            <Cropper
              image={mediaRecord.url}
              crop={crop}
              zoom={zoom}
              aspect={4 / 3}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>

          <div className="mm-crop-controls">
            <label>Zoom</label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="mm-crop-slider"
            />
          </div>
        </div>

        <div className="mm-crop-footer">
          <button
            type="button"
            className="mm-crop-btn-save"
            onClick={handleSaveCrop}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Apply Crop"}
          </button>
          <button
            type="button"
            className="mm-crop-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
