import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useEvent } from "../../context/EventContext";
import firebaseStorage from "../../firebase";
import {
  calculateTotalParticipants,
  createUniqueCode,
  deobfuscatePhone,
  formatMobileNumber,
  getPersistableEvent,
  hashPhone,
  isObfuscated,
  normalizeChild,
  obfuscatePhone,
  verifyMobileNumber,
} from "../../utils/helpers";
import Spinner from "../common/Spinner";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import { useMessage } from "../message/MessageContext";
import QRCodeCard from "./eventQRCode";
import ChildrenForm from "./participant/ChildrenForm";

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
    forceEditParticipant,
    setForceEditParticipant,
    currentUid,
  } = useEvent();

  const [newGift, updateNewGift] = useState("");
  const [participantCode, updateParticipantCode] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [eventParticipantId, updateEventParticipantId] = useState("");
  // Manage local editing state derived from context flag
  const [editingAfterDraw, setEditingAfterDraw] = useState(!!forceEditParticipant);

  useEffect(() => {
    // Consume the context flag and clear it so it doesn't persist across views
    if (forceEditParticipant && setForceEditParticipant) {
      setForceEditParticipant(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When asked to force edit (from results) or when a participant is set on the event,
  // prefill the registration form with the participant's existing data.
  useEffect(() => {
    const p = currentEvent?.currentParticipant;
    if (!p) return;

    // Only prefill when explicitly asked OR when fields are empty
    if (forceEditParticipant || !participantName) {
      updateParticipantName(p.name || "");

      // Mobile phone may be obfuscated; try deobfuscating with known key
      let phoneForDisplay = p.mobilePhone || "";
      try {
        if (isObfuscated(phoneForDisplay)) {
          const key = (currentEvent?.code || "") + p.id;
          const deob = deobfuscatePhone(phoneForDisplay, key);
          phoneForDisplay = formatMobileNumber(deob);
        } else {
          phoneForDisplay = formatMobileNumber(phoneForDisplay);
        }
      } catch (err) {
        console.warn("Failed to deobfuscate phone for participant prefill:", err);
      }

      updateParticipantPhone(phoneForDisplay || "");
      updateParticipantsChildren(p.children || []);
      updateGifts(p.gifts || []);

      if (forceEditParticipant) {
        setEditingAfterDraw(true);
        if (setForceEditParticipant) setForceEditParticipant(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.currentParticipant, forceEditParticipant]);

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
    return eventParticipants.find((participant) => {
      // Check name match
      if (participant.name === participantName.trim()) return true;

      // Check phone match - compare digits
      // If celular is obfuscated, try to deobfuscate first
      let pPhoneDigits;
      if (isObfuscated(participant.mobilePhone)) {
        const key = (currentEvent?.code || "") + participant.id;
        const deobfuscated = deobfuscatePhone(participant.mobilePhone, key);
        pPhoneDigits = deobfuscated.replace(/\D/g, "");
      } else {
        pPhoneDigits = (participant.mobilePhone || "").replace(/\D/g, "");
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
    const obfuscatedPhone = obfuscatePhone(
      participantPhone.trim(),
      obfuscationKey
    );

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

    return eventParticipants.map((participant) => {
      if (participant.id !== existingParticipant.id) return participant;

      // Obfuscate phone for storage
      const obfuscationKey = (currentEvent?.code || "") + participant.id;
      const obfuscatedPhone = obfuscatePhone(
        participantPhone.trim(),
        obfuscationKey
      );

      return {
        ...participant,
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
      const normalizePhone = (phoneInput) => (phoneInput || "").replace(/\D/g, "");
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
    // Ensure the participant form fields are in sync with the updated currentParticipant
    const updatedCurrentParticipant = updatedEvent.currentParticipant;
    if (updatedCurrentParticipant) {
      updateParticipantsChildren(updatedCurrentParticipant.children || []);
      updateGifts(updatedCurrentParticipant.gifts || []);
      updateParticipantName(updatedCurrentParticipant.name || "");

      // Deobfuscate phone for display if needed
      let phoneForDisplay = updatedCurrentParticipant.mobilePhone || "";
      if (isObfuscated(phoneForDisplay)) {
        try {
          const key = (updatedEvent?.code || "") + updatedCurrentParticipant.id;
          const deob = deobfuscatePhone(phoneForDisplay, key);
          phoneForDisplay = formatMobileNumber(deob);
        } catch (err) {
          console.warn("Failed to deobfuscate phone for updated participant:", err);
        }
      } else {
        phoneForDisplay = formatMobileNumber(phoneForDisplay);
      }
      updateParticipantPhone(phoneForDisplay || "");
    }
    // After updating participant info while in draw mode, return to results
    if (updatedEvent.drawn) {
      if (setForceEditParticipant) setForceEditParticipant(false);
      updateView("resultado");
    }
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
    let createdParticipantId = null;

    if (existingParticipant) {
      updatedEvent = {
        ...currentEvent,
        participants: await updateExistingParticipant(existingParticipant),
      };
      createdParticipantId = existingParticipant.id;

      // Make sure the currentParticipant is updated to reflect new participant data
      const updatedParticipant = updatedEvent.participants
        .find((participant) => participant.id === existingParticipant.id);
      if (updatedParticipant) updatedEvent.currentParticipant = updatedParticipant;
    } else {
      isNewParticipant = true;
      const newParticipant = await createNewParticipant();
      createdParticipantId = newParticipant.id;

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

      // If this user or flow is currently the active participant, set it as currentParticipant
      updatedEvent.currentParticipant = newParticipant;

      if (isForcedAdmin) {
        // Persist adminParticipantId at event root so ownership is recorded
        updatedEvent.adminParticipantId = newParticipant.id;
        // Record the event creator as the admin participant id (first participant)
        updatedEvent.createdBy = newParticipant.id;
        // Set createdByUid on the event for direct ownership check
        if (newParticipant.createdByUid) {
          updatedEvent.createdByUid = newParticipant.createdByUid;
          updatedEvent.adminUid = newParticipant.createdByUid;
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
          const normalizePhone = (phoneInput) => (phoneInput || "").replace(/\D/g, "");
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
          // Mark success so UI shows confirmation instead of empty inputs
          updateParticipantCode(createdParticipantId);
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

      // Mark success so UI shows confirmation instead of empty inputs
      if (createdParticipantId) updateParticipantCode(createdParticipantId);
      showSuccessMessage(!!existingParticipant);
    } catch (error) {
      message.error({ message: "Erro ao cadastrar. Tente novamente." });
      console.error("Erro ao cadastrar participante:", error);
    }
  };

  // ===== View Result After Draw =====
  const showParticipantResult = async () => {
    const inputDigits = (eventParticipantId || "").replace(/\D/g, "");
    if (!inputDigits || inputDigits.length < 10) {
      message.error({ message: "Informe um número de celular válido." });
      return;
    }

    // We need to match hash
    const inputHash = await hashPhone(inputDigits);

    const foundParticipant = eventParticipants.find((participant) => {
      if (participant.mobilePhoneHash) {
        return participant.mobilePhoneHash === inputHash;
      }
      // Fallback for non-hashed phones (older data)
      return false;
    });

    if (!foundParticipant) {
      // Try to recover by checking obfuscated phones if hash is missing (legacy)
      const matchLegacy = eventParticipants.find((participant) => {
        if (!participant.mobilePhoneHash && participant.mobilePhone) {
          // If obfuscated
          if (isObfuscated(participant.mobilePhone)) {
            const key = (currentEvent?.code || "") + participant.id;
            const clear = deobfuscatePhone(participant.mobilePhone, key);
            return clear.replace(/\D/g, "") === inputDigits;
          }
          // If clear
          return participant.mobilePhone.replace(/\D/g, "") === inputDigits;
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
  const renderSuccessCard = () => (
    <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 text-center">
      <p className="text-xl text-green-800 font-semibold mb-4">
        {successMessage}
      </p>
      <p className="text-green-700">
        Agora é só aguardar o sorteio!
      </p>
    </div>
  );

  const renderRegistrationForm = () => (
    <>
      {isDrawComplete && editingAfterDraw && (
        <div className="mb-2 text-sm text-gray-600">
          Nota: <strong>Alterar sugestões de presentes não altera o resultado do sorteio já realizado.</strong>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label className="block text-sm font-medium text-gray-700">
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

      <div className="flex flex-col gap-2">
        <label className="block text-sm font-medium text-gray-700">
          Celular (com DDD)
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

      <div className="flex flex-col gap-2 pb-4 border-b">
        <label className="block text-sm font-medium text-gray-700">
          Minhas sugestões de presentes
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ex: Livro, camiseta, caneca..."
            value={newGift}
            onChange={(e) => updateNewGift(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGift()}
            className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg"
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
        <ChildrenForm
          childrenList={participantsChildren}
          onUpdateChildren={updateParticipantsChildren}
        />
      )}

      <button
        onClick={registerParticipant}
        className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
      >
        {findExistingParticipant() ? "Atualizar Cadastro" : "Cadastrar"}
      </button>
      {isDrawComplete && editingAfterDraw && (
        <div className="pb-4 border-b">
          <button
            onClick={() => {
              setEditingAfterDraw(false);
              if (setForceEditParticipant) setForceEditParticipant(false);
              updateView("resultado");
            }}
            className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition"
          >
            Cancelar edição
          </button>
        </div>
      )}

      {currentEvent && !isDrawComplete && (
        <div>
          <QRCodeCard
            url={`${window.location.origin}?code=${currentEvent.code}`}
            label="Compartilhe este evento"
            size={192}
            eventName={currentEvent.name}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-semibold text-gray-800 text-sm text-gray-600">
          Participantes:{" "}
          {includeChildren
            ? calculateTotalParticipants(eventParticipants)
            : eventParticipants.length}
          {hasChildren ? ", incluindo filhos" : ""}
        </p>
        <ul className="grid grid-cols-2 gap-2 list-disc list-inside">
          {eventParticipants
            .slice()
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
            )
            .map(renderParticipantListItem)}
        </ul>
      </div>
    </>
  );

  const renderParticipantListItem = (participant) => {
    const childrenList = includeChildren ? participant.children || [] : [];
    const sortedChildrenList = (childrenList || []).slice().sort((a, b) => {
      const nameA = typeof a === "string" ? a : a?.name || String(a);
      const nameB = typeof b === "string" ? b : b?.name || String(b);
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });

    return (
      <li key={participant.id} className="font-medium text-sm text-gray-600">
        {participant.name}

        {sortedChildrenList.length > 0 && (
          <ul className="list-[circle] list-inside pl-5 text-gray-600 font-normal">
            {sortedChildrenList.map((child, i) => {
              const childName = typeof child === "string" ? child : child.name;
              return <li key={i}>{childName}</li>;
            })}
          </ul>
        )}
      </li>
    );
  };

  const renderDrawCompletedView = () => (
    <div className="flex flex-col gap-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
        <p className="text-green-800 font-semibold">Sorteio já realizado!</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="block text-sm font-medium text-gray-700">
          Confirme seu celular para ver o resultado
        </label>
        <input
          type="tel"
          placeholder="(11) 99999-9999"
          value={eventParticipantId}
          onChange={(e) =>
            updateEventParticipantId(formatMobileNumber(e.target.value))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              showParticipantResult();
            }
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
        <button
          onClick={showParticipantResult}
          className="w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition"
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

    if (isDrawComplete && !editingAfterDraw) {
      return renderDrawCompletedView();
    }

    return (
      <div className="flex flex-col gap-4">
        {participantCode && renderSuccessCard()}
        {!participantCode && renderRegistrationForm()}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="flex flex-col gap-4 max-w-md mx-auto">
        <Header />
        <button
          onClick={() =>
            updateView(
              accessedViaParticipantCode && currentEvent?.drawn ? "resultado" : "home"
            )
          }
          className="text-left text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        <div className="border flex flex-col gap-4 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {currentEvent?.name}
          </h2>

          {(currentEvent?.suggestedValue || currentEvent?.plannedDrawDate) && (
            <div className="pb-4 border-b">
              {currentEvent?.suggestedValue && (
                <p className="text-gray-600">
                  Valor sugerido:{" "}
                  <span className="font-bold">
                    R$ {currentEvent.suggestedValue}
                  </span>
                </p>
              )}
              {currentEvent?.plannedDrawDate && (
                <p className="text-gray-600">
                  Data do sorteio:{" "}
                  <span className="font-bold">
                    {new Date(currentEvent.plannedDrawDate).toLocaleDateString(
                      "pt-BR"
                    )}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Show admin access button when the current logged-in participant is the admin */}
          {accessedViaParticipantCode &&
            (() => {
              // Check if current session participant is admin
              const _isAdminFromCurrentParticipant = !!(
                currentEvent?.currentParticipant &&
                currentEvent.currentParticipant.isAdmin
              );

              // Check if authenticated user created the event (Firebase Auth UID)
              const isEventCreator =
                currentUid &&
                currentEvent?.createdByUid &&
                currentEvent.createdByUid === currentUid;

              // Check if authenticated user owns any admin participant (fallback for older events)
              const isAdminParticipantOwner = (() => {
                if (!currentUid) return false;

                // If active session exists, prioritize its admin status
                if (currentEvent?.currentParticipant) {
                  return currentEvent.currentParticipant.isAdmin;
                }

                // Otherwise, check if user owns any admin participant record
                const parts = currentEvent?.participants || [];
                return parts
                  .filter((p) => p.createdByUid === currentUid)
                  .some((p) => p.isAdmin);
              })();

              // Logic: Prioritize active session context.
              // If a specific participant is logged in, trust their admin status.
              // Fallback to UID ownership only if no specific participant context exists.
              const showAdminButton = currentEvent?.currentParticipant
                ? currentEvent.currentParticipant.isAdmin
                : (isEventCreator || isAdminParticipantOwner);

              return (
                showAdminButton && (
                  <div>
                    <button
                      onClick={() => updateView("admin")}
                      className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700"
                    >
                      Acessar Admin
                    </button>
                  </div>
                )
              );
            })()}
          {renderEventContent()}
        </div>
        <Footer />
      </div>
    </div>
  );
}
