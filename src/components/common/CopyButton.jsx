import { useState } from "react";

export default function CopyButton({
  text,
  className,
  label = "Copiar",
  copiedLabel = "Copiado!",
  onCopy, // Add this prop
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      
      // Call the onCopy callback if provided
      if (onCopy) {
        onCopy(text);
      }
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const titleText = copied
    ? (typeof copiedLabel === "string" ? copiedLabel : "Copiado!")
    : (typeof label === "string" ? label : "Copiar");

  return (
    <button
      onClick={handleCopy}
      className={`px-2 py-2 rounded bg-gray-200 hover:bg-gray-300 ${className || ""
        }`}
      title={titleText}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}