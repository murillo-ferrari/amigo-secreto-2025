import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import ConfirmModal from "./ConfirmModal";
import { MessageContext } from "./MessageContext";

export function MessageProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);

  const notify = useCallback(
    ({ type = "info", title, message, duration = 5000 }) => {
      const options = {
        description: message,
        duration,
      };

      switch (type) {
        case "success":
          return toast.success(title, options);
        case "error":
          return toast.error(title, options);
        case "warn":
        case "warning":
          return toast.warning(title, options);
        case "info":
        default:
          return toast.info(title, options);
      }
    },
    []
  );

  const confirm = useCallback(
    ({
      title,
      message,
      confirmText = "Confirmar",
      cancelText = "Cancelar",
    }) => {
      return new Promise((resolve) => {
        setConfirmState({ title, message, confirmText, cancelText, resolve });
      });
    },
    []
  );

  const handleConfirm = (accepted) => {
    if (confirmState?.resolve) confirmState.resolve(accepted);
    setConfirmState(null);
  };

  const api = useMemo(
    () => ({
      notify,
      confirm,
      success: (opts) => notify({ ...opts, type: "success" }),
      error: (opts) => notify({ ...opts, type: "error" }),
      info: (opts) => notify({ ...opts, type: "info" }),
      warn: (opts) => notify({ ...opts, type: "warn" }),
    }),
    [notify, confirm]
  );

  useEffect(() => {
    // Expose a global fallback so non-React utilities can use the message system.
    const previous = window.appMessage;
    window.appMessage = api;
    return () => {
      window.appMessage = previous;
    };
  }, [api]);

  return (
    <MessageContext.Provider value={api}>
      {children}
      <Toaster position="top-right" richColors />
      <ConfirmModal
        open={!!confirmState}
        {...confirmState}
        onClose={handleConfirm}
      />
    </MessageContext.Provider>
  );
}

export default MessageProvider;
