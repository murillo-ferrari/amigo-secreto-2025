import { useCallback, useEffect, useState } from "react";

const DURATION = 200; // animation duration in ms

function Toast({ toast, onRemove }) {
  const { id, type, title, message, duration } = toast;
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = useCallback(() => {
    if (isExiting) return; // Prevent multiple calls
    // Start exit animation (fade only)
    setIsExiting(true);
    setIsVisible(false);
    // Wait for animation to complete before actually removing
    setTimeout(() => onRemove(id), DURATION);
  }, [id, isExiting, onRemove]);

  // Start entrance animation after mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(handleRemove, duration);
    return () => clearTimeout(t);
  }, [duration, handleRemove]);

  const colorByType = {
    success: "bg-green-50 border-green-400 text-green-800",
    error: "bg-red-50 border-red-400 text-red-800",
    warn: "bg-yellow-50 border-yellow-400 text-yellow-800",
    info: "bg-blue-50 border-blue-400 text-blue-800",
  }[type || "info"];

  // Animation classes:
  // - Entering: slide from right (translate-x-full) → center (translate-x-0)
  // - Visible: center position + opaque
  // - Exiting: fade out only (keep position)
  const getAnimationClass = () => {
    if (isVisible && !isExiting) {
      return "opacity-100 translate-x-0";
    }
    if (isExiting) {
      return "opacity-0 translate-x-0"; // Fade out, keep position
    }
    // Initial - off-screen to the right
    return "opacity-0 translate-x-full";
  };

  return (
    <div
      className={`max-w-sm w-full shadow-md rounded-md border p-3 mb-3 transform transition-all ${colorByType} ${getAnimationClass()}`}
      style={{ transitionDuration: `${DURATION}ms` }}
      role="status"
    >
      {title && <div className="font-semibold">{title}</div>}
      {message && <div className="text-sm mt-1">{message}</div>}
      <div className="text-xs mt-2 text-right">
        <button onClick={handleRemove} className="underline">
          Fechar
        </button>
      </div>
    </div>
  );
}

export default function Toasts({ toasts = [], onRemove }) {
  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col items-end">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
