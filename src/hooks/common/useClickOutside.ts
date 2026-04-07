import { useEffect, useRef } from "react";

// Định nghĩa kiểu Ref mở rộng để tương thích với cả RefObject và MutableRefObject, tránh lỗi TypeScript
export const useClickOutside = <T extends HTMLElement>(
  ref: { current: T | null },
  handler: (event: MouseEvent | TouchEvent) => void,
) => {
  const isStartedInsideRef = useRef(false);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent | TouchEvent) => {
      if (!ref.current) return;
      isStartedInsideRef.current = ref.current.contains(event.target as Node);
    };

    const handleMouseUp = (event: MouseEvent | TouchEvent) => {
      if (!ref.current) return;

      const isEndedInside = ref.current.contains(event.target as Node);

      if (!isStartedInsideRef.current && !isEndedInside) {
        handler(event);
      }

      isStartedInsideRef.current = false;
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("touchstart", handleMouseDown);

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("touchstart", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [ref, handler]);
};
