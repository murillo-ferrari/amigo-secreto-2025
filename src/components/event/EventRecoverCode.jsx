import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { formatMobileNumber, verifyMobileNumber } from "../../utils/helpers";
import { useMessage } from "../message/MessageContext";

export default function RecoverCode({
  recuperarPorCelular: recoverCodeByPhone,
  recuperarEventoPorCelular,
  loading,
}) {
  const [showRecover, setShowRecover] = useState(false);
  const [recoveryPhoneNumber, setRecoverCelular] = useState("");
  const [matches, setMatches] = useState(null); // null = not searched yet, [] = none, >0 = matches
  const message = useMessage();

  const startSearch = async () => {
    const valid = verifyMobileNumber(recoveryPhoneNumber);
    if (!valid.isValid) {
      if (message && message.error)
        message.error({ message: valid.errorMessage });
      else if (window.appMessage?.error)
        window.appMessage.error({ message: valid.errorMessage });
      else console.warn(valid.errorMessage);
      return;
    }

    const result = await recoverCodeByPhone(recoveryPhoneNumber);

    // Normalize different shapes returned by callers. We expect either:
    // - An array of { event, participant }
    // - An array of event objects
    // - A single { event, participant } or single event object
    const normalize = (res) => {
      if (!res) return [];
      const arr = Array.isArray(res) ? res : [res];
      return arr
        .map((item) => {
          if (!item) return null;
          if (item.event) return item;
          // If the item looks like an event object (has codigo), wrap it
          if (item.codigo || item.code) return { event: item, participant: null };
          return null;
        })
        .filter(Boolean);
    };

    const normalized = normalize(result);

    if (!normalized || normalized.length === 0) {
      setMatches([]);
      if (message && message.error)
        message.error({
          message:
            "Celular não encontrado. Verifique o número e tente novamente.",
        });
      return;
    }

    // If only one match, delegate to the App handler (if provided) so it can
    // drive navigation and participant recovery. Otherwise just display choices.
    if (normalized.length === 1) {
      setMatches(normalized);
      // If the parent component provided an explicit per-event recovery handler,
      // call it so the App can navigate to the correct participant view.
      if (recuperarEventoPorCelular) {
        const eventCode = normalized[0].event?.codigo;
        if (eventCode) await recuperarEventoPorCelular(eventCode, recoveryPhoneNumber);
      }
      return;
    }

    setMatches(normalized);
  };

  const handleSelectEvent = async (eventCode) => {
    // Delegate to App to recover participant within the specific event
    if (recuperarEventoPorCelular) {
      await recuperarEventoPorCelular(eventCode, recoveryPhoneNumber);
    } else if (window.appMessage?.error) {
      window.appMessage.error({
        message: "Não foi possível recuperar esse evento.",
      });
    }
  };

  return (
    <div>
      <div className="mt-3 text-center">
        <button
          onClick={() => {
            setShowRecover(!showRecover);
            setMatches(null);
          }}
          className="text-sm text-gray-600 underline"
        >
          Esqueci meu código
        </button>
      </div>

      {showRecover && (
        <div className="mt-3 bg-gray-50 p-3 rounded">
          <p className="text-sm text-gray-700 mb-2">
            Informe o seu WhatsApp (com DDD) para recuperar o código
          </p>
          <input
            type="tel"
            placeholder="(11) 99999-9999"
            value={recoveryPhoneNumber}
            onChange={(e) =>
              setRecoverCelular(formatMobileNumber(e.target.value))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={startSearch}
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Procurando..." : "Procurar"}
            </button>
            <button
              onClick={() => {
                setShowRecover(false);
                setRecoverCelular("");
                setMatches(null);
              }}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>

          {matches && matches.length > 1 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-700">
                Foram encontrados vários eventos com esse número. Selecione o
                evento que deseja acessar:
              </p>
              {matches.map((m) => (
                <div
                  key={m.event.codigo}
                  className="flex flex-col gap-4 p-3 bg-white rounded border items-center justify-between md:flex-row md:gap-0 md:items-center"
                >
                  <div>
                    <div className="font-medium">{m.event.nome}</div>
                    <div className="text-xs text-gray-500">
                      Código: {m.event.codigo}
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => handleSelectEvent(m.event.codigo)}
                      className="min-w-[130px] px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded inline-flex items-center gap-2 justify-center"
                    >
                      <span>Acessar</span>
                      <ExternalLink />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
