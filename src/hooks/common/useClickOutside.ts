import { useEffect } from "react";

// Định nghĩa kiểu Ref mở rộng để tương thích với cả RefObject và MutableRefObject, tránh lỗi TypeScript
export const useClickOutside = <T extends HTMLElement>(
  ref: { current: T | null },
  handler: (event: MouseEvent | TouchEvent) => void,
) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // Bỏ qua nếu tham chiếu không tồn tại hoặc người dùng nhấp chuột vào bên trong phần tử
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    // Lắng nghe cả sự kiện nhấp chuột trên máy tính và chạm trên thiết bị di động
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    // Dọn dẹp sự kiện khi component bị hủy để tránh rò rỉ bộ nhớ
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
};
