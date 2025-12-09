import { useEffect, useState } from "react";
import { useEvent } from "../../context/EventContext";
import { useFirebase } from "../../context/FirebaseContext";
import { formatMobileNumber } from "../../utils/helpers";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import EventAccessCode from "./EventAccessCode";

export default function Home() {
  // Get all state from context instead of props
  const {
    setView,
    accessCode: eventAccessCode,
    setAccessCode: updateEventAccessCode,
    retrieveParticipantByPhone: retrieveCodeByPhone,
    recoverParticipantInEvent: recuperarEventoPorCelular,
    fetchEventByCode,
    loading,
    currentUid,
  } = useEvent();

  const verified = !!currentUid;
  const [triggerAccess, setTriggerAccess] = useState(false);
  const firebase = useFirebase();

  useEffect(() => {
    return () => {
      // Clear reCAPTCHA when leaving the home screen to prevent "element removed" errors
      if (firebase?.clearRecaptcha) {
        firebase.clearRecaptcha();
      }
    };
  }, []);

  const handleAccessClick = async () => {
    const raw = eventAccessCode || "";
    const digits = raw.replace(/\D/g, "");

    // If user entered a phone number (10 or 11 digits), start SMS flow
    if (digits.length === 10 || digits.length === 11) {
      setTriggerAccess(true);
      return;
    }

    // Otherwise treat input as event code and try to fetch event directly
    const code = (raw || "").toUpperCase().trim();
    if (!code) return;
    try {
      setTriggerAccess(false);
      await fetchEventByCode(code);
    } catch (err) {
      // fetchEventByCode handles messaging; swallow errors here
      console.error("Error fetching event by code:", err);
    }
  };

  const handleReset = () => {
    setTriggerAccess(false);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    const digitsOnly = value.replace(/\D/g, "");

    // If the input starts with a digit OR contains digits with phone formatting (parenthesis),
    // treat it as a phone number
    const isPhoneInput = /^\d/.test(value) || (value.startsWith("(") && digitsOnly.length > 0);

    if (isPhoneInput) {
      // Prevent input beyond 11 digits
      if (digitsOnly.length > 11) {
        return;
      }
      updateEventAccessCode(formatMobileNumber(value));
    } else {
      // Otherwise, treat it as an event code - limit to 6 characters
      if (value.length > 6) {
        return;
      }
      updateEventAccessCode(value.toUpperCase());
    }
  };

  const rawInput = eventAccessCode || "";
  const digitsOnly = rawInput.replace(/\D/g, "");
  const isPhoneValid = digitsOnly.length >= 10;
  const isCodeLike = rawInput.trim().length > 0 && !/^\d+$/.test(rawInput.trim());
  const isInputValid = isPhoneValid || isCodeLike;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-6">
        {/* reCAPTCHA container - Firebase requires this element to exist in DOM */}
        {/* Using visibility:hidden keeps it in layout but invisible */}
        <div
          id="recaptcha-container"
          style={{
            visibility: "hidden",
            height: 0,
            overflow: "hidden"
          }}
        />
        <Header verified={verified} />

        <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
          <button
            onClick={() => setView("criar")}
            className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
          >
            Criar Novo Evento
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">ou</span>
            </div>
          </div>

          <div>
            <input
              type="text"
              placeholder="Código do evento / celular (com DDD)"
              value={eventAccessCode}
              onChange={handleInputChange}
              maxLength={15}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-3"
              disabled={triggerAccess}
            />
            {!triggerAccess && (
              <button
                onClick={handleAccessClick}
                disabled={loading || !isInputValid}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Carregando..." : "Acessar Evento"}
              </button>
            )}

            {/* Only render SMS verification component when phone flow is triggered */}
            {(digitsOnly.length === 10 || digitsOnly.length === 11) && (
              <EventAccessCode
                recuperarPorCelular={retrieveCodeByPhone}
                recuperarEventoPorCelular={recuperarEventoPorCelular}
                loading={loading}
                phoneNumber={eventAccessCode}
                triggerAccess={triggerAccess}
                onReset={handleReset}
              />
            )}
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
