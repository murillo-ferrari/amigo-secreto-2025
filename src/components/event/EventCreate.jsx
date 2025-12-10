import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useEvent } from "../../context/EventContext";
import firebaseStorage from "../../firebase";
import {
  createUniqueCode,
  formatMobileNumber,
  getPersistableEvent,
  hashPhone,
  normalizeChild,
  obfuscatePhone,
  verifyMobileNumber,
} from "../../utils/helpers";
import CopyButton from "../common/CopyButton";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import { useMessage } from "../message/MessageContext";
import ChildrenForm from "./participant/ChildrenForm";

export default function CriarEvento() {
  // Get all state from context instead of props
  const {
    setView,
    eventList,
    setEventList: updateEventList,
    setCurrentEvent: updateCurrentEvent,
  } = useEvent();

  // Step 1: Event Details
  const [eventName, setEventName] = useState("");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [plannedDrawDate, setPlannedDrawDate] = useState("");
  const [includeChildren, setIncludeChildren] = useState(true);

  // Step 2: Admin Details
  const [step, setStep] = useState(1);
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminGifts, setAdminGifts] = useState([]);
  const [newGift, setNewGift] = useState("");
  const [adminChildren, setAdminChildren] = useState([]);

  const [createdEvent, setCreatedEvent] = useState(null);
  const message = useMessage();

  const handleAdvance = () => {
    if (!eventName.trim()) {
      message.error({ message: "Digite um nome para o evento!" });
      return;
    }
    setStep(2);
  };

  const addGift = () => {
    if (!newGift.trim()) return;
    setAdminGifts([...adminGifts, newGift.trim()]);
    setNewGift("");
  };

  const removeGift = (index) => {
    setAdminGifts(adminGifts.filter((_, i) => i !== index));
  };

  const handleCreateFullEvent = async () => {
    // Validate Admin Data
    if (!adminName.trim() || !adminPhone.trim()) {
      message.error({ message: "Preencha seu nome e celular!" });
      return;
    }
    const validation = verifyMobileNumber(adminPhone);
    if (!validation.isValid) {
      message.error({ message: validation.errorMessage });
      return;
    }

    const eventUniqueCode = createUniqueCode();
    const currentUserId = firebaseStorage.getCurrentUserUid();

    // Create Admin Participant
    const phoneDigits = adminPhone.replace(/\D/g, "");
    const participantId = createUniqueCode();
    const obfuscationKey = eventUniqueCode + participantId;
    const obfuscatedPhone = obfuscatePhone(adminPhone.trim(), obfuscationKey);
    const phoneHash = await hashPhone(phoneDigits);

    const adminParticipant = {
      id: participantId,
      name: adminName.trim(),
      mobilePhone: obfuscatedPhone,
      mobilePhoneHash: phoneHash,
      children: includeChildren ? adminChildren.map(normalizeChild) : [],
      gifts: [...adminGifts],
      createdByUid: currentUserId,
      isAdmin: true,
    };

    const newEventRecord = {
      name: eventName,
      suggestedValue: suggestedValue,
      plannedDrawDate: plannedDrawDate
        ? (() => {
          const [y, m, d] = plannedDrawDate.split("-");
          return new Date(y, m - 1, d, 12, 0, 0).getTime();
        })()
        : null,
      includeChildrenOption: includeChildren,
      code: eventUniqueCode,
      participants: [adminParticipant],
      drawn: false,
      draw: {},
      creationDate: Date.now(),
      createdAt: Date.now(),
      adminUid: currentUserId,
    };

    try {
      if (firebaseStorage?.waitForAuth) {
        await firebaseStorage.waitForAuth();
      }

      // Save Event
      await firebaseStorage.set(
        `event:${eventUniqueCode}`,
        JSON.stringify(getPersistableEvent(newEventRecord))
      );

      // Update Phone Index
      if (firebaseStorage.setPhoneIndex) {
        await firebaseStorage.setPhoneIndex(phoneDigits, eventUniqueCode);
      }

      // Update Local State
      updateEventList({ ...eventList, [eventUniqueCode]: newEventRecord });
      updateCurrentEvent(newEventRecord);

      // Reset Form
      setEventName("");
      setSuggestedValue("");
      setPlannedDrawDate("");
      setAdminName("");
      setAdminPhone("");
      setAdminGifts([]);
      setAdminChildren([]);
      setStep(1);

      // Show Success
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
          onClick={() => {
            if (step === 2) setStep(1);
            else setView("home");
          }}
          className="text-left text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>

        <div className="border border flex flex-col gap-4 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {step === 1 ? "Criar Evento" : "Dados do Administrador"}
          </h2>

          {!createdEvent ? (
            <>
              {step === 1 && (
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
                      type="number"
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
                    onClick={handleAdvance}
                    className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
                  >
                    Avançar
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Seu Nome (Administrador)
                    </label>
                    <input
                      type="text"
                      placeholder="Seu nome"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Seu Celular
                    </label>
                    <input
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={adminPhone}
                      onChange={(e) =>
                        setAdminPhone(formatMobileNumber(e.target.value))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Lista de Desejos
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: Livro, Chocolate..."
                        value={newGift}
                        onChange={(e) => setNewGift(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addGift()}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={addGift}
                        className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600"
                      >
                        <Plus size={24} />
                      </button>
                    </div>
                    <ul className="space-y-2 mt-2">
                      {adminGifts.map((gift, index) => (
                        <li
                          key={index}
                          className="flex justify-between items-center bg-gray-50 p-2 rounded border"
                        >
                          <span>{gift}</span>
                          <button
                            onClick={() => removeGift(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={18} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {includeChildren && (
                    <ChildrenForm
                      childrenList={adminChildren}
                      onUpdateChildren={setAdminChildren}
                    />
                  )}

                  <button
                    onClick={handleCreateFullEvent}
                    className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
                  >
                    Criar Evento e Administrador
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col text-center">
              <div className="flex flex-col gap-2 bg-green-50 border-l-4 border-green-500 rounded-lg p-4 text-center">
                <p className="text-green-800 font-semibold">
                  Evento criado com sucesso!
                </p>
                <div className="flex flex-col text-center items-center gap-1 p-2 rounded-lg border border-l-4 border-green-400">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Código do Evento</p>
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-2xl font-bold text-gray-800 tracking-widest">
                      {createdEvent.code}
                    </p>
                    <CopyButton
                      text={createdEvent.code}
                      className="p-2 h-auto w-auto bg-transparent hover:bg-gray-200 text-gray-600"
                      label={<Copy size={16} />}
                      copiedLabel={<Copy size={16} className="text-green-600" />}
                      onCopy={() => {
                        message.success({ message: "Código do evento copiado!" });
                      }}
                    />
                  </div>
                </div>
                <p className="text-md text-gray-600">
                  Você foi cadastrado como <strong>administrador</strong>.
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      setCreatedEvent(null);
                      setView("evento");
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Acessar Evento
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
