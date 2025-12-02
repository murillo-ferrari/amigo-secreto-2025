import React, { useState } from 'react';

export default function QRCodeCard({ url, label = 'Compartilhar evento', size = 300 }) {
  const [downloading, setDownloading] = useState(false);

  if (!url) return null;

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  const downloadQR = async () => {
    try {
      setDownloading(true);
      const res = await fetch(qrSrc);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `evento_qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      console.error('Erro ao baixar QR:', err);
      alert('Erro ao baixar QR. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copiado para a área de transferência!');
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      alert('Não foi possível copiar o link.');
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4 text-center">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      <img src={qrSrc} alt="QR Code" width={size} height={size} className="mx-auto mb-3" />
      <div className="flex items-center justify-center gap-2">
        <button onClick={downloadQR} disabled={downloading} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
          {downloading ? 'Baixando...' : 'Baixar QR'}
        </button>
        <button onClick={copyLink} className="bg-gray-100 px-3 py-2 rounded hover:bg-gray-200">
          Copiar link
        </button>
      </div>
    </div>
  );
}
