import { Settings, Shuffle, Trash, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useEvent } from "../../context/EventContext";
import firebaseStorage from "../../firebase";
import { performSecretSantaDraw } from "../../utils/drawEvent";
import { calculateTotalParticipants, deobfuscatePhone, formatMobileNumber, getPersistableEvent, isObfuscated } from "../../utils/helpers";
import Spinner from "../common/Spinner";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import { useMessage } from "../message/MessageContext";
import QRCodeCard from "./eventQRCode";

export default function AdminEvento() {
  // Get all state from context instead of props
  const {
    currentEvent,
    setCurrentEvent: updateCurrentEvent,
    eventList,
    setEventList: updateEventList,
    setView,
    loading,
  } = useEvent();

  const [page, setPage] = useState(1);
  const message = useMessage();
  const pageSize = 5;
  const participants = currentEvent?.participants || [];
  const totalParticipants = participants.length;
  const hasAnyFilhos = participants.some(
    (p) => p.children && p.children.length > 0
  );
  const totalPages = Math.max(1, Math.ceil(totalParticipants / pageSize));
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

  // Editable form state for event metadata
  const [editName, setEditName] = useState(currentEvent?.name || "");
  const [editValue, setEditValue] = useState(currentEvent?.suggestedValue || "");
  const [isEditing, setIsEditing] = useState(false);

  // Helper: verify current authenticated UID is the event owner/admin creator
  const isAuthorizedAdmin = () => {
    try {
      // Check 1: If currentParticipant is set and marked as admin (they verified via phone)
      if (currentEvent?.currentParticipant?.isAdmin) {
        console.log("isAuthorizedAdmin: authorized via currentParticipant.isAdmin");
        return true;
      }

      if (!firebaseStorage || !firebaseStorage.getCurrentUserUid) return false;
      const uid = firebaseStorage.getCurrentUserUid();

      console.log("isAuthorizedAdmin check - current UID:", uid);
      console.log("isAuthorizedAdmin check - event.createdByUid:", currentEvent?.createdByUid);

      if (!uid) return false;

      // Check 2: Primary ownership: event.createdByUid (set when participant created)
      if (currentEvent?.createdByUid && currentEvent.createdByUid === uid) {
        console.log("isAuthorizedAdmin: authorized via event.createdByUid");
        return true;
      }

      // Check 3: Fallback: admin participant's createdByUid
      const adminId = currentEvent?.adminParticipantId || null;
      if (adminId) {
        const adminParticipant = (currentEvent.participants || []).find(
          (p) => p.id === adminId
        );
        console.log("isAuthorizedAdmin check - adminParticipant:", adminParticipant);
        if (adminParticipant && adminParticipant.createdByUid === uid) {
          console.log("isAuthorizedAdmin: authorized via adminParticipant.createdByUid");
          return true;
        }
      }

      // Check 4: Any participant with isAdmin flag and matching UID
      const adminByFlag = (currentEvent?.participants || []).find(
        (p) => p.isAdmin && p.createdByUid === uid
      );
      if (adminByFlag) {
        console.log("isAuthorizedAdmin: authorized via participant with isAdmin flag");
        return true;
      }

      console.log("isAuthorizedAdmin: NOT authorized");
      return false;
    } catch (error) {
      console.warn("isAuthorizedAdmin failed:", error);
      return false;
    }
  };

  const saveEventMeta = async () => {
    const nameTrim = (editName || "").trim();
    if (!nameTrim) {
      message.error({ message: "O nome do evento não pode ficar vazio." });
      return;
    }

    const updatedEvent = {
      ...currentEvent,
      name: nameTrim,
      suggestedValue: editValue || undefined,
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
        return;
      }

      await firebaseStorage.set(
        `event:${currentEvent.code}`,
        JSON.stringify(getPersistableEvent(eventToStore))
      );
      // Keep the plain admin code in-memory/state for the current session/UI,
      // but avoid persisting it to the database.
      const updatedEventForState = { ...updatedEvent };
      updateCurrentEvent(updatedEventForState);
      updateEventList({
        ...eventList,
        [currentEvent.code]: updatedEventForState,
      });
      message.success({ message: "Dados do evento salvos com sucesso!" });
      setIsEditing(false);
    } catch (error) {
      console.error("Erro ao salvar dados do evento:", error);
      message.error({ message: "Erro ao salvar. Tente novamente." });
    }
  };

  const cancelEdit = () => {
    setEditName(currentEvent?.name || "");
    setEditValue(currentEvent?.suggestedValue || "");
    setIsEditing(false);
  };

  // Avoid calling setState synchronously in an effect (can trigger cascading renders).
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const safeName = (val) => {
    if (val == null) return "";
    if (typeof val === "string") return val;
    if (typeof val === "object" && val.name) return val.name;
    return String(val);
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
      message.error({ message: "Você não está autorizado a excluir participantes." });
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
      message.error({ message: "Você não está autorizado a excluir o sorteio." });
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
      message.error({ message: "Você não está autorizado a refazer o sorteio." });
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

  const removeEvent = async (eventId) => {
    if (!isAuthorizedAdmin()) {
      message.error({ message: "Você não está autorizado a excluir este evento." });
      return false;
    }

    const confirmed = await message.confirm({
      title: "Excluir evento",
      message:
        "Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.",
    });
    if (!confirmed) return false;

    try {
      // First, attempt to remove phone index entries for all participants of this event
      try {
        const event =
          currentEvent && currentEvent.code === eventId ? currentEvent : null;
        const participants = event ? event.participants || [] : [];
        const normalizePhoneDigits = (p) => (p || "").replace(/\D/g, "");
        for (const p of participants) {
          try {
            let phone = p?.mobilePhone || null;

            // Deobfuscate if needed
            if (phone && isObfuscated(phone)) {
              const key = (event?.code || eventId) + p.id;
              phone = deobfuscatePhone(phone, key);
            }

            const phoneNorm = phone ? normalizePhoneDigits(phone) : null;
            if (
              phoneNorm &&
              firebaseStorage &&
              firebaseStorage.removePhoneIndex
            ) {
              await firebaseStorage.removePhoneIndex(phoneNorm, eventId);
            }
          } catch (error) {
            console.warn(
              "Failed to remove phone index for participant during event delete:",
              error,
              p
            );
          }
        }
      } catch (error) {
        console.warn(
          "Error while cleaning phone indices before event delete:",
          error
        );
      }

      // Now delete the event node
      await firebaseStorage.delete(`event:${eventId}`);
      const updatedEvents = { ...eventList };
      delete updatedEvents[eventId];
      updateEventList(updatedEvents);
      message.success({ message: "Evento excluído com sucesso!" });
      return true;
    } catch (error) {
      message.error({ message: "Erro ao excluir evento. Tente novamente" });
      console.error("Erro ao excluir evento:", error);
      return false;
    }
  };

  if (loading || !currentEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-2xl mx-auto pt-12">
        <Header />
        <button
          onClick={() => setView("home")}
          className="mb-4 text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>

        <div className="flex flex-col bg-white rounded-lg shadow-lg p-6">
          <p className="text-2xl text-gray-800 font-bold mb-2">
            Painel de Administração
          </p>

          <div className="mb-4 bg-gray-100 border-l-4 border-gray-500 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 mb-3">
                Detalhes do Evento
              </h3>
              {!isEditing ? (
                <button
                  onClick={() => {
                    setEditName(currentEvent?.name || "");
                    setEditValue(currentEvent?.suggestedValue || "");
                    setIsEditing(true);
                  }}
                  className="text-sm bg-gray-50 border px-3 py-1 rounded hover:bg-gray-100"
                  aria-label="Editar Evento"
                  title="Editar Evento"
                >
                  <Settings aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {!isEditing ? (
              <div className="text-sm text-gray-600">
                <p className="mb-1">
                  <strong>Nome:</strong> {currentEvent.name}
                </p>
                <p>
                  <strong>Valor sugerido:</strong>{" "}
                  {currentEvent.suggestedValue
                    ? `R$ ${currentEvent.suggestedValue}`
                    : "—"}
                </p>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      <strong>Nome:</strong>
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      <strong>Valor sugerido:</strong>
                    </label>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={saveEventMeta}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Salvar alterações
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="bg-white border px-4 py-2 rounded hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
            <div className="mt-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeChildren}
                  onChange={async (event) => {
                    if (isDrawn) return;
                    const isChecked = !!event.target.checked;
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
                      console.error(
                        "Erro ao atualizar opção includeChildrenOption:",
                        error
                      );
                      message.error({
                        message:
                          "Erro ao salvar a configuração. Tente novamente.",
                      });
                    }
                  }}
                />
                <span className="text-sm text-gray-700">
                  Incluir filhos (sem celular)
                </span>
              </label>
              {isDrawn && (
                <p className="text-xs text-gray-500 mt-1">
                  Não é possível alterar após o sorteio.
                </p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-center">
              <QRCodeCard
                url={`${window.location.origin}?code=${currentEvent.code}`}
                label="Link para convidar"
                size={128}
                eventName={currentEvent.name}
              />
            </div>
          </div>
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Participantes (
              {includeChildren
                ? calculateTotalParticipants(participants)
                : participants.length}
              {includeChildren && hasAnyFilhos ? ", incluindo filhos" : ""})
            </h3>

            {participants.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Nenhum participante ainda. Compartilhe o código{" "}
                {currentEvent.code}
              </p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const start = (currentPage - 1) * pageSize;
                  const end = Math.min(start + pageSize, totalParticipants);
                  const pageItems = participants.slice(start, end);
                  return pageItems.map((p) => (
                    <div
                      key={p.id}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">
                            {p.name}
                          </p>
                          <p className="text-sm text-gray-600">{displayPhone(p)}</p>
                          {p.children && p.children.length > 0 && (
                            <div>
                              <p className="text-sm text-gray-500">
                                Filhos:{" "}
                                {p.children
                                  .map((f) =>
                                    typeof f === "string" ? f : f.name
                                  )
                                  .join(", ")}
                              </p>
                              {p.children.map((f) => {
                                const childObject =
                                  typeof f === "string" ? null : f;
                                const giftsArray = childObject
                                  ? childObject.gifts || []
                                  : [];
                                return childObject && giftsArray.length > 0 ? (
                                  <p
                                    key={childObject.name}
                                    className="text-sm text-gray-500"
                                  >
                                    Sugestões ({childObject.name}):{" "}
                                    {giftsArray.join(", ")}
                                  </p>
                                ) : null;
                              })}
                            </div>
                          )}
                          {p.gifts && p.gifts.length > 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                              Sugestões: {p.gifts.join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!currentEvent.drawn &&
                            // Do not allow deleting the admin participant
                            ((currentEvent?.adminParticipantId || p.isAdmin) &&
                              (currentEvent.adminParticipantId === p.id ||
                                p.isAdmin) ? (
                              <button
                                disabled
                                className="text-gray-300 cursor-not-allowed"
                                title="Não é possível excluir o administrador"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => removeParticipant(p.id)}
                                className="text-red-500 hover:text-red-700"
                                title="Excluir participante"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ))}
                        </div>
                      </div>

                      {isDrawn && (
                        <div className="space-y-1 pt-2 border-t">
                          <div className="flex justify-between items-center">
                            <p className="text-sm">
                              <strong>{p.name}</strong> tirou:{" "}
                              {safeName(currentEvent.draw[p.name])}
                            </p>
                          </div>
                          {p.children &&
                            p.children.map((filho) => {
                              const childName =
                                typeof filho === "string"
                                  ? filho
                                  : filho && filho.name
                                    ? filho.name
                                    : String(filho);
                              return (
                                <div
                                  key={childName}
                                  className="flex justify-between items-center"
                                >
                                  <p className="text-sm">
                                    <strong>{childName}</strong> tirou:{" "}
                                    {safeName(currentEvent.draw[childName])}
                                  </p>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  ));
                })()}

                {totalParticipants > pageSize && (
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Mostrando{" "}
                      {Math.min(
                        (currentPage - 1) * pageSize + 1,
                        totalParticipants
                      )}{" "}
                      - {Math.min(currentPage * pageSize, totalParticipants)} de{" "}
                      {totalParticipants}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1 rounded ${currentPage === 1
                          ? "bg-gray-200 text-gray-400"
                          : "bg-white border"
                          }`}
                      >
                        Anterior
                      </button>
                      <div className="text-sm text-gray-700">
                        {page} / {totalPages}
                      </div>
                      <button
                        onClick={() =>
                          setPage((prev) => Math.min(totalPages, prev + 1))
                        }
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1 rounded ${currentPage === totalPages
                          ? "bg-gray-200 text-gray-400"
                          : "bg-white border"
                          }`}
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-semibold">
                  ✓ Sorteio realizado com sucesso!
                </p>
                {/* <p className="text-sm text-green-700">Clique nos ícones de envio para compartilhar via WhatsApp</p> */}
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
          {/* Excluir o evento */}
          <div className="mt-4">
            <button
              onClick={async () => {
                const deleted = await removeEvent(currentEvent.code);
                if (deleted) setView("home");
              }}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Excluir Evento
            </button>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
