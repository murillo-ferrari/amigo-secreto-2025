import { useEffect } from "react";
import { useEvent } from "../../context/EventContext";
import { useFirebase } from "../../context/FirebaseContext";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import EventAccessCode from "./EventAccessCode";

export default function EventPhoneVerification() {
  const {
    setView,
    accessCode: eventAccessCode,
    setAccessCode: updateEventAccessCode,
    retrieveParticipantByPhone: retrieveCodeByPhone,
    checkEventsByPhone,
    recoverParticipantInEvent: recuperarEventoPorCelular,
    loading,
  } = useEvent();
  
  const firebase = useFirebase();

  useEffect(() => {
    return () => {
      if (firebase?.clearRecaptcha) {
        firebase.clearRecaptcha();
      }
    };
  }, [firebase]);

  const handleReset = () => {
    updateEventAccessCode("");
    setView("home");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="flex flex-col gap-4 max-w-md mx-auto">
        <div
          id="recaptcha-container"
          style={{
            visibility: "hidden",
            height: 0,
            overflow: "hidden"
          }}
        />
        <Header />
        
        <button
          onClick={handleReset}
          className="text-left text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>

        <div className="flex flex-col gap-4 border bg-white rounded-lg shadow-lg p-6">
          <EventAccessCode
            recuperarPorCelular={retrieveCodeByPhone}
            checkEventsByPhone={checkEventsByPhone}
            recuperarEventoPorCelular={recuperarEventoPorCelular}
            loading={loading}
            phoneNumber={eventAccessCode}
            triggerAccess={true}
            onReset={handleReset}
          />
        </div>

        <Footer />
      </div>
    </div>
  );
}
