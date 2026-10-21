import { useState, type ImgHTMLAttributes } from "react";
import "./SmartImage.css";

const DEFAULT_FALLBACK = "/Logo.png";

type SmartImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onLoad" | "onError"
> & {
  src?: string;
  fallbackSrc?: string;
};

export default function SmartImage({
  src,
  fallbackSrc = DEFAULT_FALLBACK,
  className = "",
  alt = "",
  ...rest
}: SmartImageProps) {
  // lưu theo src để tự reset khi src đổi (không cần useEffect)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const requestedSrc = src || fallbackSrc;
  const displaySrc = failedSrc === requestedSrc ? fallbackSrc : requestedSrc;
  const isLoaded = loadedSrc === displaySrc;

  const handleError = () => {
    if (displaySrc === fallbackSrc) {
      // ảnh dự phòng cũng lỗi -> tắt shimmer, tránh lặp vô hạn
      setLoadedSrc(displaySrc);
      return;
    }
    setFailedSrc(requestedSrc);
  };

  return (
    <img
      loading="lazy"
      decoding="async"
      {...rest}
      src={displaySrc}
      alt={alt}
      className={`smart-img ${isLoaded ? "is-loaded" : ""} ${className}`.trim()}
      onLoad={() => setLoadedSrc(displaySrc)}
      onError={handleError}
    />
  );
}
