import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmModal from "./ConfirmModal";
import Toasts from "./Toasts";
import { MessageContext } from "./MessageContext";

export function MessageProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const notify = useCallback(
    ({ type = "info", title, message, duration = 5000 }) => {
      const id = Date.now() + Math.random();
      setToasts((toastsArray) => [
        ...toastsArray,
        { id, type, title, message, duration },
      ]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id) => {
    setToasts((toastsArray) => toastsArray.filter((x) => x.id !== id));
  }, []);

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
      <Toasts toasts={toasts} onRemove={removeToast} />
      <ConfirmModal
        open={!!confirmState}
        {...confirmState}
        onClose={handleConfirm}
      />
    </MessageContext.Provider>
  );
}

export default MessageProvider;
