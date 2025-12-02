import React, { useState } from 'react';

export default function CopyButton({ text, className }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`ml-3 text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 ${className || ''}`}
      title={copied ? 'Copiado!' : 'Copiar'}
    >
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}
