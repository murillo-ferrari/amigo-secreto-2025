import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  calculateTotalParticipants,
  createUniqueCode,
  formatMobileNumber,
  verifyMobileNumber,
} from "../../utils/helpers";
import CopyButton from "../common/CopyButton";
import Spinner from "../common/Spinner";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import { useMessage } from "../message/MessageContext";
import QRCodeCard from "./QRCode";

export default function EventParticipant({
  eventoAtual: currentEvent,
  setEventoAtual: updateCurrentEvent,
  eventos: eventList,
  setEventos: updateEventList,
  setView: updateView,
  nomeParticipante: participantName,
  setNomeParticipante: updateParticipantName,
  celular: participantPhone,
  setCelular: updateParticipantPhone,
  filhos: participantsChildren,
  setFilhos: updateParticipantsChildren,
  presentes: gifts,
  setPresentes: updateGifts,
}) {
  const [newGift, updateNewGift] = useState("");
  const [childrenNewGift, updateChildrenGift] = useState({});
  const [childName, updateChildName] = useState("");
  const [participantCode, updateParticipantCode] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [eventParticipantId, updateEventParticipantId] = useState("");

  const eventParticipants = currentEvent?.participantes || [];
  const message = useMessage();
  const includeChildren = currentEvent?.incluirFilhos ?? true;
  const hasChildren = includeChildren && eventParticipants.some((p) => p.filhos?.length > 0);
  const isDrawComplete = currentEvent?.sorteado;

  // ===== Phone Number Handling =====
  const handleCelularChange = (e) => {
    const valorFormatado = formatMobileNumber(e.target.value);
    updateParticipantPhone(valorFormatado);
  };

  // ===== Children Management =====
  const normalizeChild = (child) => {
    if (typeof child === "string") {
      return { nome: child, presentes: [] };
    }
    return { nome: child.nome, presentes: child.presentes || [] };
  };

  const addParticipantChild = () => {
    if (!childName.trim()) return;
    
    updateParticipantsChildren([
      ...participantsChildren,
      { nome: childName.trim(), presentes: [] },
    ]);
    updateChildName("");
  };

  const removeParticipantChild = (index) => {
    updateParticipantsChildren(participantsChildren.filter((_, i) => i !== index));
  };

  const addChildGift = (childIndex) => {
    const giftValue = (childrenNewGift[childIndex] || "").trim();
    if (!giftValue) return;

    const updatedChildren = participantsChildren.map((child, i) => {
      if (i !== childIndex) return child;
      
      const normalized = normalizeChild(child);
      return {
        ...normalized,
        presentes: [...normalized.presentes, giftValue],
      };
    });

    updateParticipantsChildren(updatedChildren);
    updateChildrenGift({ ...childrenNewGift, [childIndex]: "" });
  };

  const removeChildGift = (childIndex, giftIndex) => {
    const updatedChildren = participantsChildren.map((child, i) => {
      if (i !== childIndex) return child;
      if (typeof child === "string") return child;

      return {
        ...child,
        presentes: (child.presentes || []).filter((_, pi) => pi !== giftIndex),
      };
    });

    updateParticipantsChildren(updatedChildren);
  };

  // ===== Gift Management =====
  const addGift = () => {
    if (!newGift.trim()) return;
    
    updateGifts([...gifts, newGift.trim()]);
    updateNewGift("");
  };

  const removeGift = (index) => {
    updateGifts(gifts.filter((_, i) => i !== index));
  };

  // ===== Participant Registration =====
  const validateParticipantData = () => {
    if (!participantName.trim() || !participantPhone.trim()) {
      message.error({ message: "Preencha nome e celular!" });
      return false;
    }

    const validation = verifyMobileNumber(participantPhone);
    if (!validation.isValid) {
      message.error({ message: validation.errorMessage });
      return false;
    }

    return true;
  };

  const findExistingParticipant = () => {
    return eventParticipants.find(
      (p) =>
        p.nome === participantName.trim() ||
        p.celular === participantPhone.trim()
    );
  };

  const normalizeChildren = () => {
    return (participantsChildren || []).map(normalizeChild);
  };

  const createNewParticipant = (accessCode) => {
    return {
      id: createUniqueCode(),
      nome: participantName.trim(),
      celular: participantPhone.trim(),
      filhos: includeChildren ? normalizeChildren() : [],
      presentes: [...gifts],
      codigoAcesso: accessCode,
    };
  };

  const updateExistingParticipant = (existingParticipant) => {
    return eventParticipants.map((p) =>
      p.id === existingParticipant.id
        ? {
            ...p,
            nome: participantName.trim(),
            celular: participantPhone.trim(),
            filhos: includeChildren ? normalizeChildren() : [],
            presentes: [...gifts],
          }
        : p
    );
  };

  const saveEventToStorage = async (updatedEvent, newParticipantPhone = null) => {
    await window.storage.set(
      `evento:${currentEvent.codigo}`,
      JSON.stringify(updatedEvent)
    );
    
    // Create phone index for new participant (for phone lookup feature)
    if (newParticipantPhone && window.storage.setPhoneIndex) {
      await window.storage.setPhoneIndex(newParticipantPhone, currentEvent.codigo);
    }
    
    updateCurrentEvent(updatedEvent);
    updateEventList({ ...eventList, [currentEvent.codigo]: updatedEvent });
  };

  const clearParticipantForm = () => {
    updateParticipantName("");
    updateParticipantPhone("");
    updateParticipantsChildren([]);
    updateGifts([]);
  };

  const showSuccessMessage = (isUpdate, accessCode) => {
    updateParticipantCode(accessCode);
    setSuccessMessage(
      isUpdate ? "Cadastro atualizado com sucesso!" : "✓ Cadastrado com sucesso!"
    );
    clearParticipantForm();
  };

  const registerParticipant = async () => {
    if (!validateParticipantData()) return;

    const existingParticipant = findExistingParticipant();
    let updatedEvent;
    let accessCode;

    let isNewParticipant = false;
    
    if (existingParticipant) {
      accessCode = existingParticipant.codigoAcesso;
      updatedEvent = {
        ...currentEvent,
        participantes: updateExistingParticipant(existingParticipant),
      };
    } else {
      isNewParticipant = true;
      accessCode = createUniqueCode();
      const newParticipant = createNewParticipant(accessCode);
      updatedEvent = {
        ...currentEvent,
        participantes: [...eventParticipants, newParticipant],
      };
    }

    try {
      // Pass phone number for new participants to create phone index
      await saveEventToStorage(updatedEvent, isNewParticipant ? participantPhone.trim() : null);
      showSuccessMessage(!!existingParticipant, accessCode);
    } catch (error) {
      message.error({ message: "Erro ao cadastrar. Tente novamente." });
      console.error("Erro ao cadastrar participante:", error);
    }
  };

  // ===== View Result After Draw =====
  const showParticipantResult = () => {
    const foundParticipant = eventParticipants.find(
      (p) => p.codigoAcesso === eventParticipantId.toUpperCase()
    );

    if (!foundParticipant) {
      message.error({ message: "Código inválido!" });
      return;
    }

    updateCurrentEvent({ ...currentEvent, participanteAtual: foundParticipant });
    updateView("resultado");
  };

  // ===== Render Helpers =====
  const renderChildGiftItem = (child, childIndex) => {
    const normalized = normalizeChild(child);
    const { nome: childNameDisplay, presentes: childGifts } = normalized;

    return (
      <div key={childIndex} className="bg-gray-50 p-3 rounded">
        <div className="flex items-center justify-between">
          <span className="font-medium">{childNameDisplay}</span>
          <button
            onClick={() => removeParticipantChild(childIndex)}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-2">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Sugestão para este filho"
              value={childrenNewGift[childIndex] || ""}
              onChange={(e) =>
                updateChildrenGift({
                  ...childrenNewGift,
                  [childIndex]: e.target.value,
                })
              }
              onKeyPress={(e) => e.key === "Enter" && addChildGift(childIndex)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => addChildGift(childIndex)}
              className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {childGifts.length > 0 && (
            <div className="space-y-1">
              {childGifts.map((gift, giftIndex) => (
                <div
                  key={giftIndex}
                  className="flex items-center justify-between bg-white px-3 py-1 rounded"
                >
                  <span className="text-sm text-gray-700">{gift}</span>
                  <button
                    onClick={() => removeChildGift(childIndex, giftIndex)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderParticipantListItem = (participant) => {
    const childrenNames =
      (includeChildren ? (participant.filhos?.map((f) => (typeof f === "string" ? f : f.nome)) || []) : []);
    const hasGifts = participant.presentes?.length > 0;
    const hasChildGifts = includeChildren && participant.filhos?.some(
      (f) => typeof f !== "string" && f.presentes?.length > 0
    );

    return (
      <div key={participant.id} className="text-sm text-gray-700">
        {participant.nome}
        {childrenNames.length > 0 && ` (+ ${childrenNames.join(", ")})`}
        
        {hasGifts && (
          <div className="text-xs text-gray-500 mt-1">
            Sugestões: {participant.presentes.join(", ")}
          </div>
        )}
        
        {hasChildGifts && (
          <div className="text-xs text-gray-500 mt-1">
            {participant.filhos.map((child, i) => {
              const normalized = normalizeChild(child);
              return normalized.presentes.length > 0 ? (
                <div key={i}>
                  Sugestões ({normalized.nome}): {normalized.presentes.join(", ")}
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>
    );
  };

  const renderSuccessCard = () => (
    <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 text-center">
      <p className="text-green-800 font-semibold mb-2">{successMessage}</p>
      <p className="text-sm text-green-700 mb-3">
        Guarde este código para ver seu amigo secreto depois do sorteio:
      </p>
      <div className="bg-white border border-green-500 rounded-lg p-4 mb-3 flex items-center justify-between">
        <p className="text-3xl font-bold text-green-600 tracking-wider">
          {participantCode}
        </p>
        <CopyButton text={participantCode} />
      </div>
    </div>
  );

  const renderRegistrationForm = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Seu Nome
        </label>
        <input
          type="text"
          placeholder="Digite seu nome"
          value={participantName}
          onChange={(e) => updateParticipantName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          WhatsApp (com DDD)
        </label>
        <input
          type="tel"
          placeholder="(11) 99999-9999"
          value={participantPhone}
          onChange={handleCelularChange}
          maxLength={15}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div className="mb-6 pb-6 border-b">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Minhas sugestões de presentes
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Ex: Livro, camiseta, caneca..."
            value={newGift}
            onChange={(e) => updateNewGift(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addGift()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
          />
          <button
            onClick={addGift}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {gifts.length > 0 && (
          <div className="space-y-2">
            {gifts.map((gift, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
              >
                <span className="text-sm">{gift}</span>
                <button
                  onClick={() => removeGift(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {includeChildren && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filhos (sem celular)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Nome do filho"
              value={childName}
              onChange={(e) => updateChildName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addParticipantChild()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={addParticipantChild}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {participantsChildren.length > 0 && (
            <div className="space-y-2">
              {participantsChildren.map((child, index) =>
                renderChildGiftItem(child, index)
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={registerParticipant}
        className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
      >
        {findExistingParticipant() ? "Atualizar Cadastro" : "Cadastrar"}
      </button>

      {currentEvent && !isDrawComplete && participantName === "" && (
        <div className="py-4">
          <QRCodeCard
            url={`${window.location.origin}?code=${currentEvent.codigo}`}
            label="Compartilhe este evento"
            size={200}
            eventName={currentEvent.nome}
          />
        </div>
      )}

      <div>
        <p className="font-semibold text-gray-800 text-sm text-gray-600 mb-2">
          Participantes: {includeChildren ? calculateTotalParticipants(eventParticipants) : eventParticipants.length}
          {hasChildren ? ", incluindo filhos" : ""}
        </p>
        <div className="space-y-1">
          {eventParticipants
            .slice()
            .sort((a, b) =>
              a.nome.localeCompare(b.nome, undefined, { sensitivity: "base" })
            )
            .map(renderParticipantListItem)}
        </div>
      </div>
    </>
  );

  const renderDrawCompletedView = () => (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p className="text-green-800 font-semibold">Sorteio já realizado!</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Digite seu código de acesso
        </label>
        <input
          type="text"
          placeholder="Código recebido no cadastro"
          value={eventParticipantId}
          onChange={(e) => updateEventParticipantId(e.target.value.toUpperCase())}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
        />
        <button
          onClick={showParticipantResult}
          className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition"
        >
          Ver Meu Amigo Secreto
        </button>
      </div>
    </div>
  );

  const renderEventContent = () => {
    if (!currentEvent) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner size={40} />
        </div>
      );
    }

    if (isDrawComplete) {
      return renderDrawCompletedView();
    }

    return (
      <div className="space-y-4">
        {participantCode && renderSuccessCard()}
        {!participantCode && renderRegistrationForm()}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-12">
        <Header />
        <button
          onClick={() => updateView("home")}
          className="mb-4 text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {currentEvent?.nome}
          </h2>
          
          {currentEvent?.valorSugerido && (
            <div className="mb-6 pb-6 border-b">
              <p className="text-gray-600">
                Valor sugerido:{" "}
                <span className="font-bold">R$ {currentEvent.valorSugerido}</span>
              </p>
            </div>
          )}

          {renderEventContent()}
        </div>
        <Footer />
      </div>
    </div>
  );
}