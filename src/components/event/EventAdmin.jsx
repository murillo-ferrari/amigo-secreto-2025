import { Settings, Shuffle, Trash, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { performSecretSantaDraw } from "../../utils/drawEvent";
import { calculateTotalParticipants, deobfuscatePhone, isObfuscated, formatMobileNumber } from "../../utils/helpers";
import CopyButton from "../common/CopyButton";
import Spinner from "../common/Spinner";
import Footer from "../layout/Footer";
import Header from "../layout/Header";
import { useMessage } from "../message/MessageContext";
import firebaseStorage from "../../firebase";
import { useEvent } from "../../context/EventContext";

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
  const participants = currentEvent?.participantes || [];
  const totalParticipants = participants.length;
  const hasAnyFilhos = participants.some(
    (p) => p.filhos && p.filhos.length > 0
  );
  const totalPages = Math.max(1, Math.ceil(totalParticipants / pageSize));
  const isDrawn = !!currentEvent?.sorteado;
  const includeChildren = currentEvent?.incluirFilhos ?? true;

  // Helper to display participant phone (deobfuscate if needed)
  const displayPhone = (participant) => {
    if (!participant?.celular) return "";
    if (isObfuscated(participant.celular)) {
      const key = (currentEvent?.codigo || "") + participant.id;
      const deobfuscated = deobfuscatePhone(participant.celular, key);
      return formatMobileNumber(deobfuscated);
    }
    return participant.celular;
  };

  // Editable form state for event metadata
  const [editName, setEditName] = useState(currentEvent?.nome || "");
  const [editValue, setEditValue] = useState(currentEvent?.valorSugerido || "");
  const [isEditing, setIsEditing] = useState(false);

  // Helper: verify current authenticated UID is the event owner/admin creator
  const isAuthorizedAdmin = () => {
    try {
      if (!firebaseStorage || !firebaseStorage.getCurrentUserUid) return false;
      const uid = firebaseStorage.getCurrentUserUid();
      if (!uid) return false;

      // Primary ownership: event.createdByUid (set when participant created)
      if (currentEvent?.createdByUid && currentEvent.createdByUid === uid)
        return true;

      // Fallback: admin participant's createdByUid
      const adminId = currentEvent?.adminParticipantId || null;
      if (adminId) {
        const adminParticipant = (currentEvent.participantes || []).find(
          (p) => p.id === adminId
        );
        if (adminParticipant && adminParticipant.createdByUid === uid) return true;
      }

      return false;
    } catch (err) {
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
      nome: nameTrim,
      valorSugerido: editValue || undefined,
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
        `evento:${currentEvent.codigo}`,
        JSON.stringify(eventToStore)
      );
      // Keep the plain admin code in-memory/state for the current session/UI,
      // but avoid persisting it to the database.
      const updatedEventForState = { ...updatedEvent };
      updateCurrentEvent(updatedEventForState);
      updateEventList({
        ...eventList,
        [currentEvent.codigo]: updatedEventForState,
      });
      message.success({ message: "Dados do evento salvos com sucesso!" });
      setIsEditing(false);
    } catch (error) {
      console.error("Erro ao salvar dados do evento:", error);
      message.error({ message: "Erro ao salvar. Tente novamente." });
    }
  };

  const cancelEdit = () => {
    setEditName(currentEvent?.nome || "");
    setEditValue(currentEvent?.valorSugerido || "");
    setIsEditing(false);
  };

  // Avoid calling setState synchronously in an effect (can trigger cascading renders).
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const safeName = (val) => {
    if (val == null) return "";
    if (typeof val === "string") return val;
    if (typeof val === "object" && val.nome) return val.nome;
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

    const participantToRemove = (currentEvent.participantes || []).find(
      (p) => p.id === participantId
    );

    const updatedEvent = {
      ...currentEvent,
      participantes: (currentEvent.participantes || []).filter(
        (p) => p.id !== participantId
      ),
      sorteado: false,
      sorteio: {},
    };

    try {
      await firebaseStorage.set(
        `evento:${currentEvent.codigo}`,
        JSON.stringify(updatedEvent)
      );

      // Clean up phone index for the removed participant (best-effort)
      try {
        const normalizePhoneDigits = (p) => (p || "").replace(/\D/g, "");
        let phone = participantToRemove?.celular || null;
        
        // Deobfuscate if needed
        if (phone && isObfuscated(phone)) {
          const key = (currentEvent?.codigo || "") + participantToRemove.id;
          phone = deobfuscatePhone(phone, key);
        }
        
        const phoneNorm = phone ? normalizePhoneDigits(phone) : null;
        if (phoneNorm && firebaseStorage.removePhoneIndex) {
          await firebaseStorage.removePhoneIndex(phoneNorm, currentEvent.codigo);
        }
      } catch (err) {
        console.warn(
          "Erro ao limpar índice de telefone do participante removido:",
          err
        );
      }

      updateCurrentEvent(updatedEvent);
      updateEventList({ ...eventList, [currentEvent.codigo]: updatedEvent });
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
      sorteado: false,
      sorteio: {},
      dataSorteio: null,
    };

    try {
      await firebaseStorage.set(
        `evento:${currentEvent.codigo}`,
        JSON.stringify(refreshedEvent)
      );
      updateCurrentEvent(refreshedEvent);
      updateEventList({ ...eventList, [currentEvent.codigo]: refreshedEvent });
      message.success({ message: "Sorteio excluído com sucesso!" });
    } catch (error) {
      message.error({ message: "Erro ao excluir sorteio. Tente novamente." });
      console.error("Erro ao excluir sorteio:", error);
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
          currentEvent && currentEvent.codigo === eventId ? currentEvent : null;
        const participants = event ? event.participantes || [] : [];
        const normalizePhoneDigits = (p) => (p || "").replace(/\D/g, "");
        for (const p of participants) {
          try {
            let phone = p?.celular || null;
            
            // Deobfuscate if needed
            if (phone && isObfuscated(phone)) {
              const key = (event?.codigo || eventId) + p.id;
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
      await firebaseStorage.delete(`evento:${eventId}`);
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
                    setEditName(currentEvent?.nome || "");
                    setEditValue(currentEvent?.valorSugerido || "");
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
                  <strong>Nome:</strong> {currentEvent.nome}
                </p>
                <p>
                  <strong>Valor sugerido:</strong>{" "}
                  {currentEvent.valorSugerido
                    ? `R$ ${currentEvent.valorSugerido}`
                    : "—"}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 items-end">
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
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
              <p className="text-sm text-gray-800">
                <strong>Código Participantes</strong>
              </p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-blue-600">
                  {currentEvent.codigo}
                </p>
                <CopyButton text={currentEvent.codigo} />
              </div>
            </div>
            {/* Admin code removed from UI - admin is now the first participant */}
          </div>

          <div className="mb-6">
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
                      incluirFilhos: isChecked,
                    };
                    await firebaseStorage.set(
                      `evento:${currentEvent.codigo}`,
                      JSON.stringify(updatedEvent)
                    );
                    updateCurrentEvent(updatedEvent);
                    updateEventList({
                      ...eventList,
                      [currentEvent.codigo]: updatedEvent,
                    });
                  } catch (error) {
                    console.error(
                      "Erro ao atualizar opção incluirFilhos:",
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
                {currentEvent.codigo}
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
                            {p.nome}
                          </p>
                          <p className="text-sm text-gray-600">{displayPhone(p)}</p>
                          {p.filhos && p.filhos.length > 0 && (
                            <div>
                              <p className="text-sm text-gray-500">
                                Filhos:{" "}
                                {p.filhos
                                  .map((f) =>
                                    typeof f === "string" ? f : f.nome
                                  )
                                  .join(", ")}
                              </p>
                              {p.filhos.map((f) => {
                                const childObject =
                                  typeof f === "string" ? null : f;
                                const giftsArray = childObject
                                  ? childObject.presentes || []
                                  : [];
                                return childObject && giftsArray.length > 0 ? (
                                  <p
                                    key={childObject.nome}
                                    className="text-sm text-gray-500"
                                  >
                                    Sugestões ({childObject.nome}):{" "}
                                    {giftsArray.join(", ")}
                                  </p>
                                ) : null;
                              })}
                            </div>
                          )}
                          {p.presentes && p.presentes.length > 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                              Sugestões: {p.presentes.join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {p.codigoAcesso}
                          </span>
                          {!currentEvent.sorteado &&
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
                              <strong>{p.nome}</strong> tirou:{" "}
                              {safeName(currentEvent.sorteio[p.nome])}
                            </p>
                          </div>
                          {p.filhos &&
                            p.filhos.map((filho) => {
                              const childName =
                                typeof filho === "string"
                                  ? filho
                                  : filho && filho.nome
                                    ? filho.nome
                                    : String(filho);
                              return (
                                <div
                                  key={childName}
                                  className="flex justify-between items-center"
                                >
                                  <p className="text-sm">
                                    <strong>{childName}</strong> tirou:{" "}
                                    {safeName(currentEvent.sorteio[childName])}
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

          {currentEvent.sorteado && (
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
                const deleted = await removeEvent(currentEvent.codigo);
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
