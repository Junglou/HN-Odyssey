import { createPortal } from "react-dom";
import type { ReactNode } from "react";

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
  if (!isOpen) return null;

  return createPortal(
    <div className="um-modal-overlay" onClick={onClose} role="presentation">
      {children}
    </div>,
    document.body,
  );
}
