import { useEffect, useState } from "react";
import { useEvent } from "../../context/EventContext";
import { useFirebase } from "../../context/FirebaseContext";
import { formatMobileNumber } from "../../utils/helpers";
import Spinner from "../common/Spinner";
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
    checkEventsByPhone,
    recoverParticipantInEvent: recuperarEventoPorCelular,
    fetchEventByCode,
    loading,
  } = useEvent();
  const [triggerAccess, setTriggerAccess] = useState(false);
  const firebase = useFirebase();

  useEffect(() => {
    return () => {
      // Clear reCAPTCHA when leaving the home screen to prevent "element removed" errors
      if (firebase?.clearRecaptcha) {
        firebase.clearRecaptcha();
      }
    };
  }, [firebase]);

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

    // If the input starts with a digit OR contains a parenthesis,
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

  // Detect input type based on first character
  const isPhoneInput = /^[\d(]/.test(rawInput.trim());
  const isCodeInput = /^[a-zA-Z]/.test(rawInput.trim());

  // Validation rules:
  // - Phone: must be at least 14 characters (formatted)
  // - Code: must be exactly 6 characters
  const isPhoneValid = isPhoneInput && rawInput.length >= 14;
  const isCodeValid = isCodeInput && rawInput.length === 6;
  const isInputValid = isPhoneValid || isCodeValid;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="flex flex-col gap-4 max-w-md mx-auto">
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
        <Header />
        {triggerAccess && (
          <button
            onClick={() => { 
              setView("home"); 
              updateEventAccessCode(""); 
              setTriggerAccess(false); 
            }}
            className="text-left text-gray-600 hover:text-gray-800"
          >
            ← Voltar
          </button>
        )}
        <div className="flex flex-col gap-4 border bg-white rounded-lg shadow-lg p-6">
          {/* Show Spinner only if loading AND NOT in phone verification flow (which handles its own loading) */}
          {loading && !triggerAccess ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              {!triggerAccess ? (
                <>
                  {/* Create New Event */}
                  <button
                    onClick={() => setView("criar")}
                    className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
                  >
                    Criar Novo Evento
                  </button>
                  {/* Separator */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">ou</span>
                    </div>
                  </div>
                  {/* Access Existing Event */}
                  <input
                    type="text"
                    placeholder="Código do evento / celular (com DDD)"
                    value={eventAccessCode}
                    onChange={handleInputChange}
                    maxLength={15}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleAccessClick}
                    disabled={loading || !isInputValid}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Acessar Evento
                  </button>
                </>
              ) : (
                /* Only render SMS verification component when phone flow is triggered */
                (digitsOnly.length === 10 || digitsOnly.length === 11) && (
                  <EventAccessCode
                    recuperarPorCelular={retrieveCodeByPhone}
                    checkEventsByPhone={checkEventsByPhone}
                    recuperarEventoPorCelular={recuperarEventoPorCelular}
                    loading={loading}
                    phoneNumber={eventAccessCode}
                    triggerAccess={triggerAccess}
                    onReset={handleReset}
                  />
                )
              )}
            </>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}