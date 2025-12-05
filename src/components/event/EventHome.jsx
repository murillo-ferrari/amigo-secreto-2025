import { useState, useEffect } from "react";
import { formatMobileNumber } from "../../utils/helpers";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import EventAccessCode from "./EventAccessCode";
import { useFirebase } from "../../context/FirebaseContext";
import { useEvent } from "../../context/EventContext";

export default function Home() {
  // Get all state from context instead of props
  const {
    setView,
    accessCode: eventAccessCode,
    setAccessCode: updateEventAccessCode,
    retrieveParticipantByPhone: retrieveCodeByPhone,
    recoverParticipantInEvent: recuperarEventoPorCelular,
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

  const handleAccessClick = () => {
    const digits = (eventAccessCode || "").replace(/\D/g, "");
    if (digits.length < 10) {
      return; // Input validation handled by disabled state
    }
    setTriggerAccess(true);
  };

  const handleReset = () => {
    setTriggerAccess(false);
  };

  const isPhoneValid = (eventAccessCode || "").replace(/\D/g, "").length >= 10;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-12">
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
              type="tel"
              placeholder="Digite seu celular (com DDD)"
              value={eventAccessCode}
              onChange={(e) =>
                updateEventAccessCode(formatMobileNumber(e.target.value))
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-3"
              disabled={triggerAccess}
            />
            {!triggerAccess && (
              <button
                onClick={handleAccessClick}
                disabled={loading || !isPhoneValid}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Carregando..." : "Acessar Evento"}
              </button>
            )}

            <EventAccessCode
              recuperarPorCelular={retrieveCodeByPhone}
              recuperarEventoPorCelular={recuperarEventoPorCelular}
              loading={loading}
              phoneNumber={eventAccessCode}
              triggerAccess={triggerAccess}
              onReset={handleReset}
            />
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
