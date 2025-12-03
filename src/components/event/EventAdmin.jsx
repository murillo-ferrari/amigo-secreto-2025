import { Shuffle, Trash, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { performSecretSantaDraw } from "../../utils/drawEvent";
import { calculateTotalParticipants } from "../../utils/helpers";
import CopyButton from "../common/CopyButton";
import Spinner from "../common/Spinner";
import Footer from "../layout/Footer";
import Header from "../layout/Header";

export default function AdminEvento({
  eventoAtual: currentEvent,
  setEventoAtual: updateCurrentEvent,
  eventos: eventList,
  setEventos: updateEventList,
  setView,
  loading,
}) {
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const participants = currentEvent?.participantes || [];
  const totalParticipants = participants.length;
  const hasAnyFilhos = participants.some(
    (p) => p.filhos && p.filhos.length > 0
  );
  const totalPages = Math.max(1, Math.ceil(totalParticipants / pageSize));
  const isDrawn = !!currentEvent?.sorteado;

  // Avoid calling setState synchronously in an effect (can trigger cascading renders).
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const safeName = (val) => {
    if (val == null) return "";
    if (typeof val === "string") return val;
    if (typeof val === "object" && val.nome) return val.nome;
    return String(val);
  };

  const removeParticipant = async (participantId) => {
    if (!confirm("Tem certeza que deseja excluir este participante?")) {
      return;
    }

    const updatedEvent = {
      ...currentEvent,
      participants: (currentEvent.participantes || []).filter(
        (p) => p.id !== participantId
      ),
      sorteado: false,
      sorteio: {},
    };

    try {
      await window.storage.set(
        `evento:${currentEvent.codigo}`,
        JSON.stringify(updatedEvent)
      );
      updateCurrentEvent(updatedEvent);
      updateEventList({ ...eventList, [currentEvent.codigo]: updatedEvent });
    } catch (error) {
      alert("Erro ao excluir participante. Tente novamente.", error);
    }
  };

  const deleteCurrentDraw = async () => {
    if (
      !confirm(
        "Tem certeza que deseja excluir o sorteio atual? Isso permitirá realizar um novo sorteio."
      )
    ) {
      return;
    }

    const refreshedEvent = {
      ...currentEvent,
      sorteado: false,
      sorteio: {},
      dataSorteio: null,
    };

    try {
      await window.storage.set(
        `evento:${currentEvent.codigo}`,
        JSON.stringify(refreshedEvent)
      );
      updateCurrentEvent(refreshedEvent);
      updateEventList({ ...eventList, [currentEvent.codigo]: refreshedEvent });
      alert("Sorteio excluído com sucesso!");
    } catch (error) {
      alert("Erro ao excluir sorteio. Tente novamente.", error);
    }
  };

  const redoSecretDraw = async () => {
    if (
      !confirm(
        "Tem certeza que deseja refazer o sorteio? O sorteio anterior será descartado."
      )
    ) {
      return;
    }

    await performSecretSantaDraw(
      currentEvent,
      updateCurrentEvent,
      eventList,
      updateEventList
    );
  };

  const removeEvent = async (eventId) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }

    try {
      await window.storage.delete(`evento:${eventId}`);
      const updatedEvents = { ...eventList };
      delete updatedEvents[eventId];
      updateEventList(updatedEvents);
      alert("Evento excluído com sucesso!");
    } catch (error) {
      alert("Erro ao excluir evento. Tente novamente", error);
    }
  };

  /*  const enviarWhatsApp = (nome, amigo, celular) => {
     const url = gerarLinkWhatsApp(nome, amigo, celular, eventoAtual.nome, eventoAtual.valorSugerido);
     window.open(url, '_blank');
   }; */

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

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {currentEvent.nome}
          </h2>
          <p className="text-gray-600 mb-6">Painel de Administração</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Código Participantes</p>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-blue-600">
                  {currentEvent.codigo}
                </p>
                <CopyButton text={currentEvent.codigo} className="ml-2" />
              </div>
            </div>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Código Admin</p>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-purple-600">
                  {currentEvent.codigoAdmin}
                </p>
                <CopyButton
                  text={currentEvent.codigoAdmin || ""}
                  className="ml-2"
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Participantes ({calculateTotalParticipants(participants)}
              {hasAnyFilhos ? ", incluindo filhos" : ""})
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
                          <p className="text-sm text-gray-600">{p.celular}</p>
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
                          {!currentEvent.sorteado && (
                            <button
                              onClick={() => removeParticipant(p.id)}
                              className="text-red-500 hover:text-red-700"
                              title="Excluir participante"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
                  <div className="flex items-center justify-between mt-4">
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
                        className={`px-3 py-1 rounded ${
                          currentPage === 1
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
                        className={`px-3 py-1 rounded ${
                          currentPage === totalPages
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
              onClick={() =>
                performSecretSantaDraw(
                  currentEvent,
                  updateCurrentEvent,
                  eventList,
                  updateEventList
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
                await removeEvent(currentEvent.codigo);
                setView("home");
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
