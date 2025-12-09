import { useState } from "react";
import CopyButton from "../common/CopyButton";
import { useMessage } from "../message/MessageContext";

export default function QRCodeCard({
  url,
  label = "Compartilhar evento",
  size = 300,
  eventName = "",
}) {
  const [downloading, setDownloading] = useState(false);
  const message = useMessage();

  if (!url) return null;

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    url
  )}`;

  const downloadQR = async () => {
    try {
      setDownloading(true);
      const qrCodeResponse = await fetch(qrSrc);
      const blob = await qrCodeResponse.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      // Create a sanitized file name using the event name when available
      const baseName = eventName || "evento";
      const sanitize = (inputString) =>
        inputString
          .toString()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9 _-]/g, "")
          .trim()
          .replace(/[\s-]+/g, "_");
      const filename = `${sanitize(baseName)}_qr.png`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (error) {
      console.error("Erro ao baixar QR:", error);
      const errPayload = { message: "Erro ao baixar QR. Tente novamente." };

      if (message && message.error) {
        message.error(errPayload);
        return;
      }

      if (window.appMessage?.error) {
        window.appMessage.error(errPayload);
        return;
      }

      console.warn("Erro ao baixar QR. Tente novamente.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full rounded-lg text-center">
      <p className="font-semibold text-gray-800">{label}</p>
      <div className="flex flex-row gap-2 items-center justify-center">
        <img
          src={qrSrc}
          alt="QR Code"
          width={size}
          height={size}
          className="mx-auto"
        />
        <div className="flex flex-col gap-2">
          <button
            onClick={downloadQR}
            disabled={downloading}
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          >
            {downloading ? "Baixando..." : "Baixar QR"}
          </button>
          <CopyButton
            text={url}
            className="px-3 py-2"
            label="Copiar link"
            copiedLabel="Link copiado!"
          />
        </div>
      </div>
    </div>
  );
}
