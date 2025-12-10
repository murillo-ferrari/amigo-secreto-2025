import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useFirebase } from "../../context/FirebaseContext";
import { formatMobileNumber, verifyMobileNumber } from "../../utils/helpers";
import { useMessage } from "../message/MessageContext";
import Spinner from "../common/Spinner";

export default function EventAccessCode({
  recuperarPorCelular: recoverCodeByPhone,
  checkEventsByPhone,
  recuperarEventoPorCelular,
  loading,
  phoneNumber = "",
  triggerAccess = false,
  onReset = null,
}) {
  const [step, setStep] = useState("idle"); // idle | sending | code | searching | results
  const [smsCode, setSmsCode] = useState("");
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState("");
  const [internalLoading, setInternalLoading] = useState(false);
  const message = useMessage();
  const firebase = useFirebase();

  // When parent triggers access, start the SMS flow
  useEffect(() => {
    let mounted = true;

    if (triggerAccess && phoneNumber && mounted) {
      handleStartSmsVerification();
    }

    return () => {
      mounted = false;
      if (firebase?.clearRecaptcha) {
        firebase.clearRecaptcha();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerAccess, phoneNumber]);

  const reset = () => {
    setStep("idle");
    setSmsCode("");
    setMatches([]);
    setError("");
    setInternalLoading(false);
    if (firebase?.clearRecaptcha) {
      firebase.clearRecaptcha();
    }
    if (onReset) onReset();
  };

  const handleStartSmsVerification = async () => {
    /* console.log("=== handleStartSmsVerification started ===");
    console.log("phoneNumber:", phoneNumber); */

    // Validate phone
    const valid = verifyMobileNumber(phoneNumber);
    if (!valid.isValid) {
      // console.log("Phone validation failed:", valid.errorMessage);
      setError(valid.errorMessage);
      if (message?.error) message.error({ message: valid.errorMessage });
      return;
    }

    setError("");
    setInternalLoading(true);

    // Check if phone exists in any event BEFORE sending SMS
    if (checkEventsByPhone) {
      try {
        const existingEvents = await checkEventsByPhone(phoneNumber);
        if (!existingEvents || existingEvents.length === 0) {
          setError("Este número não está cadastrado em nenhum evento.");
          if (message?.error)
            message.error({ message: "Número não encontrado." });
          setInternalLoading(false);
          // Reset trigger so user can try again
          if (onReset) onReset();
          return;
        }
      } catch (err) {
        console.error("Error checking phone existence:", err);
        setError("Erro ao verificar cadastro. Tente novamente.");
        setInternalLoading(false);
        return;
      }
    }

    // Check if this phone was already verified in the current session
    const isVerifiedInSession = firebase?.isPhoneVerifiedInSession && await firebase.isPhoneVerifiedInSession(phoneNumber);
    // console.log("isPhoneVerifiedInSession:", isVerifiedInSession);

    if (isVerifiedInSession) {
      // console.log("Phone already verified in session, skipping SMS verification");
      // Only proceed to search if we are not already searching or showing results
      if (step !== "searching" && step !== "results") {
        setStep("searching");
        await performSearch();
      }
      return;
    }

    // console.log("Phone NOT in session cache, proceeding with SMS verification...");
    setStep("sending");

    try {
      // console.log("firebase?.sendPhoneVerification exists:", !!firebase?.sendPhoneVerification);
      if (firebase?.sendPhoneVerification) {
        // console.log("Calling sendPhoneVerification...");
        await firebase.sendPhoneVerification(phoneNumber);
        // console.log("SMS sent successfully, showing code input");
        setStep("code");
      } else {
        // Phone Auth not available - skip verification and go directly to search
        console.warn(
          "Phone Auth not available, proceeding without SMS verification"
        );
        await performSearch();
      }
    } catch (error) {
      console.error("SMS send failed:", error);

      const errorCode = error?.code || "";
      const errorMsg = error?.message || "";

      // Erros que BLOQUEIAM completamente (sem fallback - proteção contra exploits)
      const blockedErrors = ["auth/too-many-requests", "auth/quota-exceeded"];
      if (blockedErrors.includes(errorCode)) {
        const msg =
          errorCode === "auth/too-many-requests"
            ? "Muitas tentativas de acesso. Por segurança, aguarde 15 minutos antes de tentar novamente."
            : "Limite de SMS excedido. Tente novamente mais tarde.";
        setError(msg);
        setStep("blocked");
        if (onReset) onReset();
        setInternalLoading(false);
        return;
      }

      // Erros de configuração (volta ao idle para tentar novamente)
      const configErrors = {
        "auth/invalid-app-credential":
          "Erro de configuração do reCAPTCHA. Verifique se o domínio está autorizado no Firebase Console.",
        "auth/missing-phone-provider":
          "Autenticação por telefone não está habilitada. Habilite no Firebase Console.",
        "auth/invalid-phone-number":
          "Número de telefone inválido. Verifique o formato.",
        "auth/captcha-check-failed":
          "Falha na verificação do reCAPTCHA. Se você está usando um número de teste, verifique se ele está configurado no Firebase Console.",
      };

      if (configErrors[errorCode] || errorMsg.includes("reCAPTCHA")) {
        setError(
          configErrors[errorCode] || configErrors["auth/invalid-app-credential"]
        );
        setStep("idle");
        if (onReset) onReset();
        setInternalLoading(false);
        return;
      }

      // Fallback: erro desconhecido - tenta buscar sem SMS (ambiente de dev/teste)
      setError("Não foi possível enviar SMS. Buscando diretamente...");
      await performSearch();
    } finally {
      setInternalLoading(false);
    }
  };

  const confirmSmsCode = async () => {
    if (!smsCode || smsCode.length < 6) {
      setError("Digite o código de 6 dígitos recebido por SMS");
      return;
    }

    setError("");
    setInternalLoading(true);

    try {
      if (firebase?.confirmPhoneCode) {
        await firebase.confirmPhoneCode(smsCode);
      }
      // After confirmation, search for events
      await performSearch();
    } catch (error) {
      console.error("SMS confirmation failed:", error);
      setError("Código inválido ou expirado. Tente novamente.");
      setInternalLoading(false);
    }
  };

  const performSearch = async () => {
    setStep("searching");
    setInternalLoading(true);

    try {
      const result = await recoverCodeByPhone(phoneNumber);

      // Normalize results
      const normalized = normalizeResults(result);

      if (!normalized || normalized.length === 0) {
        setMatches([]);
        setStep("results");
        setError(
          "Celular não encontrado em nenhum evento. Verifique o número."
        );
        if (message?.error) {
          message.error({
            message:
              "Celular não encontrado. Verifique o número e tente novamente.",
          });
        }
        return;
      }

      // Single match: navigate directly
      if (normalized.length === 1) {
        const eventCode = normalized[0].event?.code;
        if (eventCode && recuperarEventoPorCelular) {
          await recuperarEventoPorCelular(eventCode, phoneNumber);
          reset();
          return;
        }
      }

      // Multiple matches: show selection UI
      setMatches(normalized);
      setStep("results");
    } catch (err) {
      console.error("Search failed:", err);
      setError("Erro ao buscar eventos. Tente novamente.");
      setStep("results");
    } finally {
      setInternalLoading(false);
    }
  };

  const normalizeResults = (res) => {
    if (!res) return [];
    const arr = Array.isArray(res) ? res : [res];
    return arr
      .map((item) => {
        if (!item) return null;
        if (item.event) return item;
        if (item.code || item.code) return { event: item, participant: null };
        return null;
      })
      .filter(Boolean);
  };

  const handleSelectEvent = async (eventCode) => {
    if (recuperarEventoPorCelular) {
      await recuperarEventoPorCelular(eventCode, phoneNumber);
      reset();
    }
  };

  const isLoading = loading || internalLoading;

  // Render nothing when idle
  if (step === "idle") {
    return null;
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg border">
      {/* Sending SMS */}
      {step === "sending" && (
        <div className="flex flex-col gap-2 items-center justify-center py-8">
          <Spinner />
          <p className="text-gray-700">
            Enviando código SMS para {formatMobileNumber(phoneNumber)}...
          </p>
        </div>
      )}

      {/* Enter SMS Code */}
      {step === "code" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-700 text-center">
            Digite o código de 6 dígitos enviado para
            <br />
            <strong>{formatMobileNumber(phoneNumber)}</strong>
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={smsCode}
            onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-mono"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={confirmSmsCode}
              disabled={isLoading || smsCode.length < 6}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {isLoading ? "Verificando..." : "Confirmar Código"}
            </button>
            <button
              onClick={reset}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Cancelar
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Não recebeu? Aguarde alguns segundos e tente novamente.
          </p>
        </div>
      )}

      {/* Searching */}
      {step === "searching" && (
        <div className="flex flex-col gap-2 items-center justify-center py-8">
          <Spinner />
          <p className="text-gray-700">Buscando seus eventos...</p>
        </div>
      )}

      {/* Results: Multiple events */}
      {step === "results" && matches.length > 1 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-700 text-center font-medium">
            Encontramos {matches.length} eventos com esse número. <br />
            Selecione qual deseja acessar:
          </p>
          <div className="flex flex-col gap-2">
            {matches.map((m) => (
              <div
                key={m.event.code}
                className="flex flex-col gap-3 p-3 bg-white rounded-lg border items-center justify-between sm:flex-row"
              >
                <div className="text-center sm:text-left">
                  <div className="font-medium text-gray-800">
                    {m.event.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    Código: {m.event.code}
                  </div>
                </div>
                <button
                  onClick={() => handleSelectEvent(m.event.code)}
                  className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg inline-flex items-center gap-2 justify-center font-medium transition"
                >
                  <span>Acessar</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results: No events found */}
      {step === "results" && matches.length === 0 && (
        <div className="flex flex-col gap-4 items-center justify-center py-4">
          <p className="text-gray-700">
            {error || "Nenhum evento encontrado para este número."}
          </p>
          <button
            onClick={reset}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Tentar outro número
          </button>
        </div>
      )}

      {/* Blocked: Rate limit or quota exceeded - NO fallback allowed */}
      {step === "blocked" && (
        <div className="flex flex-col gap-4 items-center text-center py-6">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <p className="text-red-600 font-semibold text-lg">
              Acesso Temporariamente Bloqueado
            </p>
            <p className="text-gray-600">{error}</p>
          </div>
          <button
            onClick={reset}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  );
}
