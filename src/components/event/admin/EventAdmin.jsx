import { Shuffle, Trash, Trash2 } from "lucide-react";
import { useEvent } from "../../../context/EventContext";
import firebaseStorage from "../../../firebase";
import { performSecretSantaDraw } from "../../../utils/drawEvent";
import {
  calculateTotalParticipants,
  deobfuscatePhone,
  formatMobileNumber,
  getPersistableEvent,
  isObfuscated,
} from "../../../utils/helpers";
import Footer from "../../layout/Footer";
import Header from "../../layout/Header";
import { useMessage } from "../../message/MessageContext";
import EventDetailsAdmin from "./EventDetailsAdmin";
import ParticipantListAdmin from "./ParticipantListAdmin";

export default function AdminEvento() {
  // Get all state from context instead of props
  const {
    currentEvent,
    setCurrentEvent: updateCurrentEvent,
    eventList,
    setEventList: updateEventList,
    setView,
  } = useEvent();

  const message = useMessage();

  if (!currentEvent) return null;

  const participants = currentEvent?.participants || [];
  const hasAnyFilhos = participants.some(
    (p) => p.children && p.children.length > 0
  );
  const isDrawn = !!currentEvent?.drawn;
  const includeChildren = currentEvent?.includeChildrenOption ?? true;

  // Helper to display participant phone (deobfuscate if needed)
  const displayPhone = (participant) => {
    if (!participant?.mobilePhone) return "";
    if (isObfuscated(participant.mobilePhone)) {
      const key = (currentEvent?.code || "") + participant.id;
      const deobfuscated = deobfuscatePhone(participant.mobilePhone, key);
      return formatMobileNumber(deobfuscated);
    }
    return participant.mobilePhone;
  };

  // Helper: verify current authenticated UID is the event owner/admin creator
  const isAuthorizedAdmin = () => {
    try {
      // Check 1: If currentParticipant is set and marked as admin (they verified via phone)
      if (currentEvent?.currentParticipant?.isAdmin) {
        /* console.log(
          "isAuthorizedAdmin: authorized via currentParticipant.isAdmin"
        ); */
        return true;
      }

      if (!firebaseStorage || !firebaseStorage.getCurrentUserUid) return false;
      const uid = firebaseStorage.getCurrentUserUid();
      /* console.log("isAuthorizedAdmin check - current UID:", uid);
      console.log(
        "isAuthorizedAdmin check - event.createdByUid:",
        currentEvent?.createdByUid
      ); */

      if (!uid) return false;

      // Check 2: Primary ownership: event.createdByUid (set when participant created)
      if (currentEvent?.createdByUid && currentEvent.createdByUid === uid) {
        // console.log("isAuthorizedAdmin: authorized via event.createdByUid");
        return true;
      }

      // Check 3: Fallback: admin participant's createdByUid
      const adminId = currentEvent?.adminParticipantId || null;
      if (adminId) {
        const adminParticipant = (currentEvent.participants || []).find(
          (participant) => participant.id === adminId
        );
        /* console.log(
          "isAuthorizedAdmin check - adminParticipant:",
          adminParticipant
        ); */
        if (adminParticipant && adminParticipant.createdByUid === uid) {
          /* console.log(
            "isAuthorizedAdmin: authorized via adminParticipant.createdByUid"
          ); */
          return true;
        }
      }

      // Check 4: Any participant with isAdmin flag and matching UID
      const adminByFlag = (currentEvent?.participants || []).find(
        (participant) => participant.isAdmin && participant.createdByUid === uid
      );
      if (adminByFlag) {
        /* console.log(
          "isAuthorizedAdmin: authorized via participant with isAdmin flag"
        ); */
        return true;
      }
      // console.log("isAuthorizedAdmin: NOT authorized");
      return false;
    } catch (error) {
      console.warn("isAuthorizedAdmin failed:", error);
      return false;
    }
  };

  const handleSaveEventMeta = async ({ name, suggestedValue, plannedDrawDate }) => {
    const nameTrim = (name || "").trim();
    if (!nameTrim) {
      message.error({ message: "O nome do evento não pode ficar vazio." });
      return false;
    }

    const updatedEvent = {
      ...currentEvent,
      name: nameTrim,
      suggestedValue: suggestedValue || undefined,
      /* Planned draw date is a timestamp with midday hour */
      plannedDrawDate: plannedDrawDate
        ? (() => {
            const [y, m, d] = plannedDrawDate.split("-");
            return new Date(y, m - 1, d, 12, 0, 0).getTime();
          })()
        : null,
    };

    const eventToStore = { ...updatedEvent };

    try {
      // Ensure authentication is ready and present before attempting write
      try {
        if (firebaseStorage && firebaseStorage.waitForAuth) {
          await firebaseStorage.waitForAuth();
        }
      } catch (e) {
        console.warn("waitForAuth failed:", e);
      }

      if (!isAuthorizedAdmin()) {
        message.error({
          message:
            "Você não está autorizado a alterar este evento. Verifique se está usando a conta autenticada que criou o evento.",
        });
        return false;
      }

      await firebaseStorage.set(
        `event:${currentEvent.code}`,
        JSON.stringify(getPersistableEvent(eventToStore))
      );
      // Keep state for UI
      const updatedEventForState = { ...updatedEvent };
      updateCurrentEvent(updatedEventForState);
      updateEventList({
        ...eventList,
        [currentEvent.code]: updatedEventForState,
      });
      message.success({ message: "Dados do evento salvos com sucesso!" });
      return true;
    } catch (error) {
      console.error("Erro ao salvar dados do evento:", error);
      message.error({ message: "Erro ao salvar. Tente novamente." });
      return false;
    }
  };

  const removeParticipant = async (participantId) => {
    // Prevent removing the admin participant
    const adminId = currentEvent?.adminParticipantId || null;
    if (adminId && participantId === adminId) {
      message.error({
        message:
          "Não é possível excluir o participante administrador do evento.",
      });
      return;
    }

    if (!isAuthorizedAdmin()) {
      message.error({
        message: "Você não está autorizado a excluir participantes.",
      });
      return;
    }

    const confirmed = await message.confirm({
      title: "Excluir participante",
      message: "Tem certeza que deseja excluir este participante?",
    });
    if (!confirmed) return;

    const participantToRemove = (currentEvent.participants || []).find(
      (p) => p.id === participantId
    );

    const updatedEvent = {
      ...currentEvent,
      participants: (currentEvent.participants || []).filter(
        (p) => p.id !== participantId
      ),
      drawn: false,
      draw: {},
    };

    try {
      await firebaseStorage.set(
        `event:${currentEvent.code}`,
        JSON.stringify(getPersistableEvent(updatedEvent))
      );

      // Clean up phone index for the removed participant (best-effort)
      try {
        const normalizePhoneDigits = (p) => (p || "").replace(/\D/g, "");
        let phone = participantToRemove?.mobilePhone || null;

        // Deobfuscate if needed
        if (phone && isObfuscated(phone)) {
          const key = (currentEvent?.code || "") + participantToRemove.id;
          phone = deobfuscatePhone(phone, key);
        }

        const phoneNorm = phone ? normalizePhoneDigits(phone) : null;
        if (phoneNorm && firebaseStorage.removePhoneIndex) {
          await firebaseStorage.removePhoneIndex(phoneNorm, currentEvent.code);
        }
      } catch (err) {
        console.warn(
          "Erro ao limpar índice de telefone do participante removido:",
          err
        );
      }

      updateCurrentEvent(updatedEvent);
      updateEventList({ ...eventList, [currentEvent.code]: updatedEvent });
    } catch (error) {
      message.error({
        message: "Erro ao excluir participante. Tente novamente.",
      });
      console.error("Erro ao excluir participante:", error);
    }
  };

  const deleteCurrentDraw = async () => {
    if (!isAuthorizedAdmin()) {
      message.error({
        message: "Você não está autorizado a excluir o sorteio.",
      });
      return;
    }

    const confirmed = await message.confirm({
      title: "Excluir sorteio",
      message:
        "Tem certeza que deseja excluir o sorteio atual? Isso permitirá realizar um novo sorteio.",
    });
    if (!confirmed) return;

    const refreshedEvent = {
      ...currentEvent,
      drawn: false,
      draw: {},
      drawDate: null,
    };

    // Preserve currentParticipant in state for authorization
    const eventForState = { ...refreshedEvent };

    try {
      await firebaseStorage.set(
        `event:${currentEvent.code}`,
        JSON.stringify(getPersistableEvent(refreshedEvent))
      );
      updateCurrentEvent(eventForState);
      updateEventList({ ...eventList, [currentEvent.code]: eventForState });
      message.success({ message: "Sorteio excluído com sucesso!" });
    } catch (error) {
      message.error({ message: "Erro ao excluir sorteio. Tente novamente." });
      console.error("Erro ao excluir draw:", error);
    }
  };

  const redoSecretDraw = async () => {
    if (!isAuthorizedAdmin()) {
      message.error({
        message: "Você não está autorizado a refazer o sorteio.",
      });
      return;
    }

    const confirmed = await message.confirm({
      title: "Refazer sorteio",
      message:
        "Tem certeza que deseja refazer o sorteio? O sorteio anterior será descartado.",
    });
    if (!confirmed) return;

    await performSecretSantaDraw(
      currentEvent,
      updateCurrentEvent,
      eventList,
      updateEventList,
      message
    );
  };

  const removeEvent = async (eventCode) => {
    if (!isAuthorizedAdmin()) {
      message.error({
        message: "Você não está autorizado a excluir este evento.",
      });
      return false;
    }

    const confirmed = await message.confirm({
      title: "Excluir evento",
      message:
        "Atenção: Esta ação não pode ser desfeita. Todos os dados do evento serão apagados.",
    });
    if (!confirmed) return false;

    // 1. Clean up phone indexes for all participants
    // This allows them to stop seeing the deleted event in their list
    try {
      const participants = currentEvent.participants || [];
      const promises = participants.map(async (participant) => {
        let phone = participant.mobilePhone;
        if (!phone) return;

        // Deobfuscate if valid
        if (isObfuscated(phone)) {
          const key = currentEvent.code + participant.id;
          try {
            phone = deobfuscatePhone(phone, key);
          } catch (error) {
            console.warn("Deobfuscation failed for cleanup", error);
            return;
          }
        }

        const digits = (phone || "").replace(/\D/g, "");
        if (digits && firebaseStorage.removePhoneIndex) {
          await firebaseStorage.removePhoneIndex(digits, eventCode);
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.warn("Failed to cleanup some phone indexes (non-critical):", error);
    }

    try {
      if (firebaseStorage && firebaseStorage.delete) {
        await firebaseStorage.delete(`event:${eventCode}`);
      }
      message.success({ message: "Evento excluído com sucesso!" });
      updateCurrentEvent(null);
      // Remove from list
      const newList = { ...eventList };
      delete newList[eventCode];
      updateEventList(newList);
      return true;
    } catch (error) {
      console.error("Erro ao excluir evento:", error);
      message.error({ message: "Erro ao excluir evento." });
      return false;
    }
  };

  const handleUpdateIncludeChildren = async (isChecked) => {
    if (isDrawn) return;
    try {
      const updatedEvent = {
        ...currentEvent,
        includeChildrenOption: isChecked,
      };
      await firebaseStorage.set(
        `event:${currentEvent.code}`,
        JSON.stringify(getPersistableEvent(updatedEvent))
      );
      updateCurrentEvent(updatedEvent);
      updateEventList({
        ...eventList,
        [currentEvent.code]: updatedEvent,
      });
    } catch (error) {
      console.error("Erro ao atualizar opção includeChildrenOption:", error);
      message.error({
        message: "Erro ao salvar a configuração. Tente novamente.",
      });
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

        <div className="border flex flex-col gap-4 bg-white rounded-lg shadow-lg p-6">
          <EventDetailsAdmin
            currentEvent={currentEvent}
            isDrawn={isDrawn}
            onSave={handleSaveEventMeta}
            onUpdateIncludeChildren={handleUpdateIncludeChildren}
          />
          <ParticipantListAdmin
            participants={participants}
            currentEvent={currentEvent}
            includeChildren={includeChildren}
            hasAnyFilhos={hasAnyFilhos}
            onRemoveParticipant={removeParticipant}
            displayPhone={displayPhone}
          />
        </div>
        {/* Button to perform draw */}
        {!isDrawn && participants.length >= 2 && (
          <button
            onClick={async () =>
              await performSecretSantaDraw(
                currentEvent,
                updateCurrentEvent,
                eventList,
                updateEventList,
                message
              )
            }
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
            disabled={calculateTotalParticipants(participants) < 2}
          >
            <Shuffle className="w-5 h-5" />
            Realizar Sorteio
          </button>
        )}

        {currentEvent.drawn && (
          <div className="flex flex-col gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
              <p className="text-green-800 font-semibold">
                ✓ Sorteio realizado com sucesso!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={redoSecretDraw}
                className="bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <Shuffle className="w-5 h-5" />
                Refazer Sorteio
              </button>

              <button
                onClick={deleteCurrentDraw}
                className="bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition flex items-center justify-center gap-2"
              >
                <Trash className="w-5 h-5" />
                Excluir Sorteio
              </button>
            </div>
          </div>
        )}
        {/* Button to delete event */}
        <div>
          <button
            onClick={async () => {
              const deleted = await removeEvent(currentEvent.code);
              if (deleted) setView("home");
            }}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2"
          >
            <Trash2 />
            Excluir Evento
          </button>
        </div>
        <Footer />
      </div>
    </div>
  );
}
