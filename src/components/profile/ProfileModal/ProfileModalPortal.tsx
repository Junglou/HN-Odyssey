import { createPortal } from "react-dom";
import { useRef, type ReactNode } from "react";

type ProfileModalPortalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Renders overlay at document.body so fixed positioning covers the full viewport. */
export function ProfileModalPortal({
  isOpen,
  onClose,
  children,
}: ProfileModalPortalProps) {
  const pointerStartedOnOverlay = useRef(false);

  if (!isOpen) return null;

  const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    pointerStartedOnOverlay.current = event.target === event.currentTarget;
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const releasedOnOverlay = event.target === event.currentTarget;
    if (pointerStartedOnOverlay.current && releasedOnOverlay) {
      onClose();
    }
    pointerStartedOnOverlay.current = false;
  };

  return createPortal(
    <div
      className="um-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="presentation"
    >
      {children}
    </div>,
    document.body,
  );
}
