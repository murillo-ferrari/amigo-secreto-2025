import { useEffect, useState } from "react";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onClose,
}) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Animation duration (ms) — keep in sync with CSS transition
  const DURATION = 200;

  // Handle mounting/unmounting
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setShouldRender(true), 0);
      return () => clearTimeout(timer);
    } else {
      // Delay unmount to allow exit animation
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, DURATION);

      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle visibility animation
  useEffect(() => {
    if (shouldRender && open) {
      // Small delay to ensure DOM has mounted before starting animation
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);

      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 0);
      return () => clearTimeout(timer);
    }
  }, [shouldRender, open]);

  // Don't render anything if not mounted
  if (!shouldRender) return null;

  // Calculate animation state
  const isExiting = shouldRender && !open;

  // Overlay animation: fade in/out
  const overlayClass = isVisible
    ? "opacity-100"
    : "opacity-0 pointer-events-none";

  // Dialog animation logic:
  // - Entering: slide from right + transparent + scaled down → center
  // - Visible: center position + opaque + full scale
  // - Exiting: fade out only (keep position and scale)
  const getDialogAnimationClass = () => {
    if (isVisible && !isExiting) {
      return "opacity-100 translate-x-0 scale-100";
    }

    if (isExiting) {
      return "opacity-0 translate-x-0 scale-100"; // Fade out, keep position
    }

    // Entering or initial - slide from right
    return "opacity-0 translate-x-8 scale-95";
  };

  const handleCancel = () => {
    onClose(false);
  };

  const handleConfirm = () => {
    onClose(true);
  };

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop itself, not the dialog
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center items-start px-4 bg-black/50 transition-opacity ${overlayClass}`}
      style={{ transitionDuration: `${DURATION}ms` }}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "confirm-title" : undefined}
        aria-describedby={message ? "confirm-message" : undefined}
        className={`mt-24 bg-white rounded-lg shadow-xl max-w-lg w-full p-6 transition-all ${getDialogAnimationClass()}`}
        style={{ transitionDuration: `${DURATION}ms` }}
      >
        {title && (
          <h3 id="confirm-title" className="text-xl font-semibold text-gray-900">
            {title}
          </h3>
        )}
        
        {message && (
          <p id="confirm-message" className="mt-3 text-sm text-gray-600 leading-relaxed">
            {message}
          </p>
        )}
        
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}