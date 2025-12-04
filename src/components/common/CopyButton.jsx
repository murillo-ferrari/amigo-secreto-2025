import { useState } from "react";

export default function CopyButton({
  text,
  className,
  label = "Copiar",
  copiedLabel = "Copiado!",
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-2 py-2 rounded bg-gray-200 hover:bg-gray-300 ${className || ""
        }`}
      title={copied ? copiedLabel : label}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
