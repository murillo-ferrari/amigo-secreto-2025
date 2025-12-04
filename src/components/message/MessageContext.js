import { createContext, useContext } from "react";

export const MessageContext = createContext(null);

export function useMessage() {
  const messageContext = useContext(MessageContext);
  if (!messageContext)
    throw new Error("useMessage must be used within MessageProvider");
  return messageContext;
}

export default MessageContext;
