import { useEvent } from "../../context/EventContext";
import Footer from "../layout/Footer";
import Header from "../layout/Header";

export default function SecretSantaResults() {
  // Get all state from context instead of props
  const {
    currentEvent,
    setView,
    setCurrentEvent: updateCurrentEvent,
    setAccessCode: updateAccessCode,
    accessedViaParticipantCode,
    currentUid,
  } = useEvent();

  const currentParticipant = currentEvent?.currentParticipant;
  const participantAccessCode = currentParticipant?.codeAcesso || "";
  const eventSuccessMessage =
    currentEvent?.successMessage ||
    (currentParticipant ? "Seu código de acesso" : null);

  // Find the participant corresponding to the drawn friend to display suggestions
  const getParticipantByName = (name) => {
    const eventParticipants = currentEvent?.participants || [];
    for (const participant of eventParticipants) {
      if (participant.name === name) return participant;
      if (participant.children) {
        for (const participantChild of participant.children) {
          if (typeof participantChild === "string") {
            if (participantChild === name)
              return { name: participantChild, gifts: [] };
          } else {
            if (participantChild.name === name) return participantChild;
          }
        }
      }
    }
    return null;
  };

  const normalizeName = (inputValue) => {
    if (inputValue == null) return "";
    if (typeof inputValue === "string") return inputValue;
    if (typeof inputValue === "object" && inputValue.name)
      return inputValue.name;
    return String(inputValue);
  };

  const normalizedFriendName = currentParticipant
    ? normalizeName(currentEvent?.draw?.[currentParticipant.name])
    : null;
  const friendObject = normalizedFriendName
    ? getParticipantByName(normalizedFriendName)
    : null;
  const frindGifts = friendObject?.gifts || [];
  const includeChildren = currentEvent?.includeChildrenOption ?? true;

  /*   const enviarWhatsApp = (nome, amigo, celular) => {
    const url = gerarLinkWhatsApp(nome, amigo, celular, eventoAtual.name, eventoAtual.suggestedValue);
    window.open(url, '_blank');
  }; */

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-6">
        <Header />
        <button
          onClick={() => {
            setView("home");
            updateCurrentEvent(null);
            updateAccessCode("");
          }}
          className="mb-4 text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {currentEvent.name}
          </h2>
          {(currentEvent.suggestedValue || currentEvent.drawDate) && (
            <div className="mb-6 pb-6 border-b">
              {currentEvent.suggestedValue && (
                <p className="text-gray-600">
                  Valor sugerido:{" "}
                  <span className="font-bold">
                    R$ {currentEvent.suggestedValue}
                  </span>
                </p>
              )}
              {currentEvent.drawDate && (
                <p className="text-gray-600 mt-1">
                  Sorteio realizado em:{" "}
                  <span className="font-bold">
                    {new Date(currentEvent.drawDate).toLocaleDateString('pt-BR')}
                  </span>
                </p>
              )}
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
              <div className="mb-6 pb-6 border-b">
                <button
                  onClick={() => setView("admin")}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
                >
                  Acessar Admin
                </button>
              </div>
            );
          })()
          }

          <div className="space-y-4">
            <div className="text-left text-xl">
              <p>
                Olá, <span className="font-bold">{currentParticipant.name}</span>!
              </p>
              {/* <p className="text-sm mt-1">Abaixo está seu amigo secreto e as sugestões de presente.</p> */}
            </div>
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Seu amigo secreto é:</p>
              <p className="text-3xl font-bold text-red-600">
                {normalizeName(currentEvent.draw[currentParticipant.name])}
              </p>
              {frindGifts.length > 0 && (
                <div className="mt-3 text-left">
                  <p className="text-sm text-gray-700 mb-1">
                    Sugestões de presente do seu amigo:
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {frindGifts.map((pres, i) => (
                      <li key={i}>{pres}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Optional: share to WhatsApp button can be re-enabled here */}
            </div>

            {includeChildren && currentParticipant.children &&
              currentParticipant.children.map((filho) => {
                const childName =
                  typeof filho === "string"
                    ? filho
                    : filho && filho.name
                      ? filho.name
                      : String(filho);
                const childFriendName = normalizeName(
                  currentEvent.draw[childName]
                );
                const childFriendObject = childFriendName
                  ? getParticipantByName(childFriendName)
                  : null;
                const childFriendGift = childFriendObject?.gifts || [];

                return (
                  <div
                    key={childName}
                    className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4"
                  >
                    <p className="text-sm text-gray-600 mb-2">
                      Amigo secreto de <b>{childName}</b>:
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {childFriendName}
                    </p>
                    {childFriendGift.length > 0 && (
                      <div className="mt-3 text-left">
                        <p className="text-sm text-gray-700 mb-1">
                          Sugestões do amigo:
                        </p>
                        <ul className="list-disc list-inside text-sm text-gray-700">
                          {childFriendGift.map((pres, i) => (
                            <li key={i}>{pres}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
