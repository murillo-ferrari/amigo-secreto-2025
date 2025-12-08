import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useEvent } from "../../context/EventContext";
import firebaseStorage from "../../firebase";
import {
  calculateTotalParticipants,
  createUniqueCode,
  deobfuscatePhone,
  formatMobileNumber,
  hashPhone,
  isObfuscated,
  obfuscatePhone,
  verifyMobileNumber,
  getPersistableEvent
} from "../../utils/helpers";
import Spinner from "../common/Spinner";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import { useMessage } from "../message/MessageContext";
import QRCodeCard from "./eventQRCode";

export default function EventParticipant() {
  // Get all state from context instead of props
  const {
    currentEvent,
    setCurrentEvent: updateCurrentEvent,
    eventList,
    setEventList: updateEventList,
    setView: updateView,
    participantName,
    setParticipantName: updateParticipantName,
    participantMobileNumber: participantPhone,
    setParticipantMobileNumber: updateParticipantPhone,
    participantChildren: participantsChildren,
    setParticipantChildren: updateParticipantsChildren,
    gifts,
    setGifts: updateGifts,
    pendingAdminEvent,
    setPendingAdminEvent,
    accessedViaParticipantCode,
    setAccessedViaParticipantCode,
    currentUid,
  } = useEvent();

  const [newGift, updateNewGift] = useState("");
  const [childrenNewGift, updateChildrenGift] = useState({});
  const [childName, updateChildName] = useState("");
  const [participantCode, updateParticipantCode] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [eventParticipantId, updateEventParticipantId] = useState("");

  const eventParticipants = currentEvent?.participants || [];
  const message = useMessage();
  const includeChildren = currentEvent?.includeChildrenOption ?? true;
  const hasChildren =
    includeChildren && eventParticipants.some((p) => p.children?.length > 0);
  const isDrawComplete = currentEvent?.drawn;

  // ===== Phone Number Handling =====
  const handleCelularChange = (e) => {
    const valorFormatado = formatMobileNumber(e.target.value);
    updateParticipantPhone(valorFormatado);
  };

  // ===== Children Management =====
  const normalizeChild = (child) => {
    if (typeof child === "string") {
      return { name: child, gifts: [] };
    }
    return { name: child.name, gifts: child.gifts || [] };
  };

  const addParticipantChild = () => {
    if (!childName.trim()) return;

    updateParticipantsChildren([
      ...participantsChildren,
      { name: childName.trim(), gifts: [] },
    ]);
    updateChildName("");
  };

  const removeParticipantChild = (index) => {
    updateParticipantsChildren(
      participantsChildren.filter((_, i) => i !== index)
    );
  };

  const addChildGift = (childIndex) => {
    const giftValue = (childrenNewGift[childIndex] || "").trim();
    if (!giftValue) return;

    const updatedChildren = participantsChildren.map((child, i) => {
      if (i !== childIndex) return child;

      const normalized = normalizeChild(child);
      return {
        ...normalized,
        gifts: [...normalized.gifts, giftValue],
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
        gifts: (child.gifts || []).filter((_, pi) => pi !== giftIndex),
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
    const inputPhoneDigits = (participantPhone || "").replace(/\D/g, "");
    return eventParticipants.find((p) => {
      // Check name match
      if (p.name === participantName.trim()) return true;

      // Check phone match - compare digits
      // If celular is obfuscated, try to deobfuscate first
      let pPhoneDigits;
      if (isObfuscated(p.mobilePhone)) {
        const key = (currentEvent?.code || "") + p.id;
        const deobfuscated = deobfuscatePhone(p.mobilePhone, key);
        pPhoneDigits = deobfuscated.replace(/\D/g, "");
      } else {
        pPhoneDigits = (p.mobilePhone || "").replace(/\D/g, "");
      }

      return pPhoneDigits === inputPhoneDigits;
    });
  };

  const normalizeChildren = () => {
    return (participantsChildren || []).map(normalizeChild);
  };

  const createNewParticipant = async () => {
    const phoneDigits = (participantPhone || "").replace(/\D/g, "");
    const participantId = createUniqueCode();

    // Obfuscate phone for storage - use eventCode + participantId as key
    const obfuscationKey = (currentEvent?.code || "") + participantId;
    const obfuscatedPhone = obfuscatePhone(participantPhone.trim(), obfuscationKey);

    // Hash phone for lookups - one-way hash, can't be reversed
    const phoneHash = await hashPhone(phoneDigits);

    const base = {
      id: participantId,
      name: participantName.trim(),
      mobilePhone: obfuscatedPhone,
      mobilePhoneHash: phoneHash, // One-way hash for phone lookups (privacy-safe)
      children: includeChildren ? normalizeChildren() : [],
      gifts: [...gifts],
    };

    try {
      if (firebaseStorage && firebaseStorage.getCurrentUserUid) {
        const uid = firebaseStorage.getCurrentUserUid();
        if (uid) base.createdByUid = uid;
      }
    } catch (error) {
      console.warn("Could not get current user UID for participant:", error);
    }

    return base;
  };

  const updateExistingParticipant = async (existingParticipant) => {
    const phoneDigits = (participantPhone || "").replace(/\D/g, "");
    // Hash phone for lookups - one-way hash, can't be reversed
    const phoneHash = await hashPhone(phoneDigits);

    return eventParticipants.map((p) => {
      if (p.id !== existingParticipant.id) return p;

      // Obfuscate phone for storage
      const obfuscationKey = (currentEvent?.code || "") + p.id;
      const obfuscatedPhone = obfuscatePhone(participantPhone.trim(), obfuscationKey);

      return {
        ...p,
        name: participantName.trim(),
        mobilePhone: obfuscatedPhone,
        mobilePhoneHash: phoneHash,
        children: includeChildren ? normalizeChildren() : [],
        gifts: [...gifts],
      };
    });
  };

  const saveEventToStorage = async (
    updatedEvent,
    newParticipantPhone = null,
    oldParticipantPhone = null
  ) => {
    // Write only the participantes subtree to respect DB rules that prevent
    // arbitrary writes to the whole event root from the client.
    if (firebaseStorage && firebaseStorage.set) {
      await firebaseStorage.set(
        `event:${currentEvent.code}/participants`,
        JSON.stringify(updatedEvent.participants || [])
      );
    }

    // Update phone index: remove old mapping (if phone changed) then set new mapping
    try {
      const normalizePhone = (p) => (p || "").replace(/\D/g, "");
      const oldNorm = oldParticipantPhone
        ? normalizePhone(oldParticipantPhone)
        : null;
      const newNorm = newParticipantPhone
        ? normalizePhone(newParticipantPhone)
        : null;

      if (oldNorm && firebaseStorage.removePhoneIndex) {
        try {
          await firebaseStorage.removePhoneIndex(oldNorm, currentEvent.code);
          console.debug(
            `Removed phone index ${oldNorm} -> ${currentEvent.code}`
          );
        } catch (err) {
          console.warn(
            "Erro ao remover índice de telefone:",
            err,
            oldNorm,
            currentEvent.code
          );
        }
      }

      if (newNorm && firebaseStorage.setPhoneIndex) {
        try {
          await firebaseStorage.setPhoneIndex(newNorm, currentEvent.code);
          console.debug(`Set phone index ${newNorm} -> ${currentEvent.code}`);
        } catch (err) {
          console.warn(
            "Erro ao criar índice de telefone:",
            err,
            newNorm,
            currentEvent.code
          );
        }
      }
    } catch (e) {
      // Phone index update is best-effort; do not block primary flow
      console.warn("Erro ao atualizar índice de telefone:", e);
    }

    // Update local state to reflect the change (we keep the in-memory event object)
    updateCurrentEvent(updatedEvent);
    updateEventList({ ...eventList, [currentEvent.code]: updatedEvent });
  };

  const clearParticipantForm = () => {
    updateParticipantName("");
    updateParticipantPhone("");
    updateParticipantsChildren([]);
    updateGifts([]);
  };

  const showSuccessMessage = (isUpdate) => {
    setSuccessMessage(
      isUpdate
        ? "Cadastro atualizado com sucesso!"
        : "✓ Cadastrado com sucesso!"
    );
    clearParticipantForm();
  };

  const registerParticipant = async () => {
    if (!validateParticipantData()) return;

    const existingParticipant = findExistingParticipant();
    let updatedEvent;

    let isNewParticipant = false;

    if (existingParticipant) {
      updatedEvent = {
        ...currentEvent,
        participants: await updateExistingParticipant(existingParticipant),
      };
    } else {
      isNewParticipant = true;
      const newParticipant = await createNewParticipant();

      // If this creation is part of the forced admin flow, mark participant as admin
      const isForcedAdmin =
        pendingAdminEvent &&
        currentEvent &&
        pendingAdminEvent === currentEvent.code;
      if (isForcedAdmin) {
        newParticipant.isAdmin = true;
      }

      updatedEvent = {
        ...currentEvent,
        participants: [...eventParticipants, newParticipant],
      };

      if (isForcedAdmin) {
        // Persist adminParticipantId at event root so ownership is recorded
        updatedEvent.adminParticipantId = newParticipant.id;
        // Record the event creator as the admin participant id (first participant)
        updatedEvent.createdBy = newParticipant.id;
        // Set createdByUid on the event for direct ownership check
        if (newParticipant.createdByUid) {
          updatedEvent.createdByUid = newParticipant.createdByUid;
        }
      }
    }

    try {
      // Determine phone index changes for updates
      if (isNewParticipant) {
        const newPhone = participantPhone.trim();

        // If this is the forced admin creation, we must write the whole event
        // so the `adminParticipantId` field is persisted. Otherwise, write only participantes subtree.
        const isForcedAdmin =
          pendingAdminEvent &&
          currentEvent &&
          pendingAdminEvent === currentEvent.code;
        if (isForcedAdmin) {
          // Full save of event (includes participantes + adminParticipantId)
          if (firebaseStorage && firebaseStorage.set) {
            await firebaseStorage.set(
              `event:${currentEvent.code}`,
              JSON.stringify(getPersistableEvent(updatedEvent))
            );
          }

          // Also update phone index for the new participant
          const normalizePhone = (p) => (p || "").replace(/\D/g, "");
          const newNorm = newPhone ? normalizePhone(newPhone) : null;
          if (newNorm && firebaseStorage.setPhoneIndex) {
            try {
              await firebaseStorage.setPhoneIndex(newNorm, currentEvent.code);
              console.debug(
                `Set phone index ${newNorm} -> ${currentEvent.code}`
              );
            } catch (err) {
              console.warn(
                "Erro ao criar índice de telefone (admin flow):",
                err,
                newNorm,
                currentEvent.code
              );
            }
          }

          // Clear pending admin flow and navigate to admin view
          if (setPendingAdminEvent) setPendingAdminEvent(null);
          updateCurrentEvent(updatedEvent);
          updateEventList({
            ...eventList,
            [currentEvent.code]: updatedEvent,
          });
          updateView("admin");
          updateView("admin");
          showSuccessMessage(false);
          return;
        }

        await saveEventToStorage(updatedEvent, newPhone, null);
      } else {
        // Get old phone - need to deobfuscate if stored obfuscated
        let oldPhone = existingParticipant?.mobilePhone || null;
        if (oldPhone && isObfuscated(oldPhone)) {
          const key = (currentEvent?.code || "") + existingParticipant.id;
          oldPhone = deobfuscatePhone(oldPhone, key);
        }

        const newPhone = participantPhone.trim();
        const oldPhoneDigits = (oldPhone || "").replace(/\D/g, "");
        const newPhoneDigits = (newPhone || "").replace(/\D/g, "");

        if (oldPhoneDigits && oldPhoneDigits !== newPhoneDigits) {
          // Phone changed - update index with old (deobfuscated) and new phone
          await saveEventToStorage(updatedEvent, newPhone, oldPhone);
        } else {
          await saveEventToStorage(updatedEvent, null, null);
        }
      }

      showSuccessMessage(!!existingParticipant);
    } catch (error) {
      message.error({ message: "Erro ao cadastrar. Tente novamente." });
      console.error("Erro ao cadastrar participante:", error);
    }
  };

  // ===== View Result After Draw =====
  // ===== View Result After Draw =====
  const showParticipantResult = async () => {
    const inputDigits = (eventParticipantId || "").replace(/\D/g, "");
    if (!inputDigits || inputDigits.length < 10) {
      message.error({ message: "Informe um número de celular válido." });
      return;
    }

    // We need to match hash
    const inputHash = await hashPhone(inputDigits);

    const foundParticipant = eventParticipants.find((p) => {
      if (p.mobilePhoneHash) {
        return p.mobilePhoneHash === inputHash;
      }
      // Fallback for non-hashed phones (older data)
      return false;
    });

    if (!foundParticipant) {
      // Try to recover by checking obfuscated phones if hash is missing (legacy)
      const matchLegacy = eventParticipants.find((p) => {
        if (!p.mobilePhoneHash && p.mobilePhone) {
          // If obfuscated
          if (isObfuscated(p.mobilePhone)) {
            const key = (currentEvent?.code || "") + p.id;
            const clear = deobfuscatePhone(p.mobilePhone, key);
            return clear.replace(/\D/g, "") === inputDigits;
          }
          // If clear
          return p.mobilePhone.replace(/\D/g, "") === inputDigits;
        }
        return false;
      });

      if (matchLegacy) {
        updateCurrentEvent({
          ...currentEvent,
          currentParticipant: matchLegacy,
        });
        setAccessedViaParticipantCode(true);
        updateView("resultado");
        return;
      }

      message.error({
        message: "Participante não encontrado com este celular!",
      });
      return;
    }

    updateCurrentEvent({
      ...currentEvent,
      currentParticipant: foundParticipant,
    });
    setAccessedViaParticipantCode(true);
    updateView("resultado");
  };

  // ===== Render Helpers =====
  const renderChildGiftItem = (child, childIndex) => {
    const normalized = normalizeChild(child);
    const { name: childNameDisplay, gifts: childGifts } = normalized;

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
    const childrenNames = includeChildren
      ? participant.children?.map((f) => (typeof f === "string" ? f : f.name)) ||
      []
      : [];
    const hasGifts = participant.gifts?.length > 0;
    const hasChildGifts =
      includeChildren &&
      participant.children?.some(
        (f) => typeof f !== "string" && f.gifts?.length > 0
      );

    return (
      <div key={participant.id} className="text-sm text-gray-700">
        {participant.name}
        {childrenNames.length > 0 && ` (+ ${childrenNames.join(", ")})`}

        {hasGifts && (
          <div className="text-xs text-gray-500 mt-1">
            Sugestões: {participant.gifts.join(", ")}
          </div>
        )}

        {hasChildGifts && (
          <div className="text-xs text-gray-500 mt-1">
            {participant.children.map((child, i) => {
              const normalized = normalizeChild(child);
              return normalized.gifts.length > 0 ? (
                <div key={i}>
                  Sugestões ({normalized.name}):{" "}
                  {normalized.gifts.join(", ")}
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
      <p className="text-xl text-green-800 font-semibold mb-4">
        {successMessage}
      </p>
      <p className="text-green-700">
        Agora é só aguardar o sorteio! <br />
        Você poderá conferir seu amigo secreto usando seu celular.
      </p>
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
            url={`${window.location.origin}?code=${currentEvent.code}`}
            label="Compartilhe este evento"
            size={200}
            eventName={currentEvent.name}
          />
        </div>
      )}

      <div>
        <p className="font-semibold text-gray-800 text-sm text-gray-600 mb-2">
          Participantes:{" "}
          {includeChildren
            ? calculateTotalParticipants(eventParticipants)
            : eventParticipants.length}
          {hasChildren ? ", incluindo filhos" : ""}
        </p>
        <div className="space-y-1">
          {eventParticipants
            .slice()
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
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
          Confirme seu celular para ver o resultado
        </label>
        <input
          type="tel"
          placeholder="(11) 99999-9999"
          value={eventParticipantId}
          onChange={(e) =>
            updateEventParticipantId(formatMobileNumber(e.target.value))
          }
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
            {currentEvent?.name}
          </h2>

          {currentEvent?.suggestedValue && (
            <div className="mb-6 pb-6 border-b">
              <p className="text-gray-600">
                Valor sugerido:{" "}
                <span className="font-bold">
                  R$ {currentEvent.suggestedValue}
                </span>
              </p>
            </div>
          )}

          {/* Show admin access button when the current logged-in participant is the admin */}
          {accessedViaParticipantCode && (() => {
            const isAdminFromCurrentParticipant = !!(
              currentEvent?.currentParticipant && currentEvent.currentParticipant.isAdmin
            );
            const isAdminFromUid = (() => {
              if (!currentUid) return false;
              const parts = currentEvent?.participants || [];
              return parts.some(
                (p) => p.isAdmin && p.createdByUid && p.createdByUid === currentUid
              );
            })();
            return (isAdminFromCurrentParticipant || isAdminFromUid) && (
              <div className="mb-4">
                <button
                  onClick={() => updateView("admin")}
                  className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700"
                >
                  Acessar Admin
                </button>
              </div>
            );
          })
          ()
          }
          {renderEventContent()}
        </div>
        <Footer />
      </div>
    </div>
  );
}
