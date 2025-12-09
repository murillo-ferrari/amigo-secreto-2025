import { useState } from "react";
import { useEvent } from "../../context/EventContext";
import firebaseStorage from "../../firebase";
import { createUniqueCode, getPersistableEvent } from "../../utils/helpers";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import { useMessage } from "../message/MessageContext";

export default function CriarEvento() {
  // Get all state from context instead of props
  const {
    setView,
    eventList,
    setEventList: updateEventList,
    setCurrentEvent: updateCurrentEvent,
    setPendingAdminEvent,
    setParticipantName,
    setParticipantMobileNumber,
    setParticipantChildren,
    setGifts,
  } = useEvent();

  const [eventName, setEventName] = useState("");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [plannedDrawDate, setPlannedDrawDate] = useState("");
  const [createdEvent, setCreatedEvent] = useState(null);
  const [includeChildren, setIncludeChildren] = useState(true);
  const message = useMessage();

  const createEvent = async () => {
    if (!eventName.trim()) {
      message.error({ message: "Digite um nome para o evento!" });
      return;
    }

    const eventUniqueCode = createUniqueCode();

    const newEventRecord = {
      name: eventName,
      suggestedValue: suggestedValue,
      plannedDrawDate: plannedDrawDate ? new Date(plannedDrawDate).getTime() : null,
      includeChildrenOption: includeChildren,
      code: eventUniqueCode,
      participants: [],
      drawn: false,
      draw: {},
      creationDate: Date.now(),
    };

    // To save in Firebase, remove the admin code in text and add ownership metadata
    const eventToSave = { ...newEventRecord };

    /* Attach createdAt timestamp. The event's `createdBy` will be set
    when the first participant (admin) is created. */
    try {
      if (firebaseStorage?.waitForAuth) {
        await firebaseStorage.waitForAuth();
      }
    } catch (e) {
      console.warn(
        "Não foi possível aguardar autenticação ao criar evento:",
        e
      );
    }

    const currentUserId = firebaseStorage.getCurrentUserUid();
    eventToSave.createdAt = Date.now();
    eventToSave.adminUid = currentUserId;
    newEventRecord.createdAt = eventToSave.createdAt;
    newEventRecord.adminUid = currentUserId;

    try {
      await firebaseStorage.set(
        `event:${eventUniqueCode}`,
        JSON.stringify(getPersistableEvent(eventToSave))
      );
      updateEventList({ ...eventList, [eventUniqueCode]: newEventRecord });
      updateCurrentEvent(newEventRecord); // Mantém o código em texto para a sessão atual
      setEventName("");
      setSuggestedValue("");
      setPlannedDrawDate("");

      // Keep created event in state so we can show a confirmation UI
      setCreatedEvent(newEventRecord);
    } catch (error) {
      message.error({ message: "Erro ao criar evento. Tente novamente." });
      console.error("Erro ao criar evento:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="flex flex-col gap-4 max-w-md mx-auto">
        <Header />
        <button
          onClick={() => setView("home")}
          className="text-left text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>

        <div className="border border flex flex-col gap-4 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Criar Evento
          </h2>

          {!createdEvent ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  Nome do Evento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Amigo Secreto da Família 2025"
                  value={eventName}
                  onChange={(event) => setEventName(event.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  Valor Sugerido (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: R$ 50,00"
                  value={suggestedValue}
                  onChange={(event) => setSuggestedValue(event.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  Data do Sorteio (opcional)
                </label>
                <input
                  type="date"
                  value={plannedDrawDate}
                  onChange={(event) => setPlannedDrawDate(event.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="includeChildren"
                  type="checkbox"
                  checked={includeChildren}
                  onChange={(event) => setIncludeChildren(event.target.checked)}
                  className="w-4 h-4"
                />
                <label
                  htmlFor="includeChildren"
                  className="text-sm text-gray-700"
                >
                  Incluir filhos (sem celular)
                </label>
              </div>

              <button
                onClick={createEvent}
                className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
              >
                Criar Evento
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-6 text-center">
                <p className="text-green-800 font-semibold mb-2">
                  Evento criado com sucesso!
                </p>
                <p className="text-sm text-gray-700 mb-4">Código do evento:</p>
                <p className="text-3xl font-bold text-green-800 mb-4">
                  {createdEvent.code}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      // Clear participant form state to prevent leakage from previous events
                      setParticipantName("");
                      setParticipantMobileNumber("");
                      setParticipantChildren([]);
                      setGifts([]);

                      // Proceed to create the first participant (admin)
                      if (setPendingAdminEvent)
                        setPendingAdminEvent(createdEvent.code);
                      setCreatedEvent(null);
                      setView("evento");
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Cadastrar Administrador
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}
