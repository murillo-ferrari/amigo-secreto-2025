import { useState } from "react";
import { createUniqueCode, hashCode } from "../../utils/helpers";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import { useMessage } from "../message/MessageContext";
import QRCodeCard from "./QRCode";

export default function CriarEvento({
  setView,
  eventos: eventList,
  setEventos: updateEventList,
  setEventoAtual: updateCurrentEvent,
}) {
  const [eventName, setEventName] = useState("");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [createdEvent, setCreatedEvent] = useState(null);
  const [includeChildren, setIncludeChildren] = useState(true);
  const message = useMessage();

  const createEvent = async () => {
    if (!eventName.trim()) {
      message.error({ message: "Digite um nome para o evento!" });
      return;
    }

    const eventUniqueCode = createUniqueCode();
    const adminUniqueCode = createUniqueCode();

    // Hash do código admin para armazenamento seguro
    const adminUniqueCodeHash = await hashCode(adminUniqueCode);

    /* Check if those pt-br string can be renamed to english */
    const newEventRecord = {
      nome: eventName,
      valorSugerido: suggestedValue,
      incluirFilhos: includeChildren,
      codigo: eventUniqueCode,
      codigoAdminHash: adminUniqueCodeHash, // Armazena hash ao invés do código em texto
      codigoAdmin: adminUniqueCode, // Mantém temporariamente para mostrar ao usuário
      participantes: [],
      sorteado: false,
      sorteio: {},
      dataCriacao: new Date().toISOString(),
    };

    // To save in Firebase, remove the admin code in text
    const eventToSave = { ...newEventRecord };
    delete eventToSave.codigoAdmin;

    try {
      await window.storage.set(
        `evento:${eventUniqueCode}`,
        JSON.stringify(eventToSave)
      );
      updateEventList({ ...eventList, [eventUniqueCode]: newEventRecord });
      updateCurrentEvent(newEventRecord); // Mantém o código em texto para a sessão atual
      setEventName("");
      setSuggestedValue("");
      // Show QR on create screen first
      setCreatedEvent(newEventRecord);
    } catch (error) {
      message.error({ message: "Erro ao criar evento. Tente novamente." });
      console.error("Erro ao criar evento:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-12">
        <Header />
        <button
          onClick={() => setView("home")}
          className="mb-4 text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Criar Evento
          </h2>

          {!createdEvent ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Evento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Amigo Secreto da Família 2024"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Sugerido (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 50,00"
                  value={suggestedValue}
                  onChange={(e) => setSuggestedValue(e.target.value)}
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
                <label htmlFor="includeChildren" className="text-sm text-gray-700">
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
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Evento criado</h3>
              <p className="text-sm text-gray-600 mb-3">
                Código de participantes: <strong>{createdEvent.codigo}</strong>
              </p>
              <QRCodeCard
                url={`${window.location.origin}?code=${createdEvent.codigo}`}
                label="Compartilhe o evento via QR"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setView("admin")}
                  className="flex-1 bg-green-600 text-white py-2 rounded"
                >
                  Ir para Admin
                </button>
                <button
                  onClick={() => {
                    setCreatedEvent(null);
                  }}
                  className="flex-1 bg-gray-100 py-2 rounded"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
