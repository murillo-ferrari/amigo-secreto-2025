import { useEvent } from "../context/EventContext";
import ErrorScreen from "./common/ErrorScreen";
import AdminEvento from "./event/EventAdmin";
import CriarEvento from "./event/EventCreate";
import Home from "./event/EventHome";
import EventParticipant from "./event/EventParticipant";
import SecretSantaResults from "./event/EventResults";

export default function AppRouter() {
    const {
        view,
        setView,
        storageError,
        setStorageError,
        accessCode,
        setAccessCode,
        fetchEventByCode,
        retrieveParticipantByPhone,
        recoverParticipantInEvent,
        loading,
        currentUid,
        eventList,
        setEventList,
        currentEvent,
        setCurrentEvent,
        pendingAdminEvent,
        setPendingAdminEvent,
        participantName,
        setParticipantName,
        participantMobileNumber,
        setParticipantMobileNumber,
        participantChildren,
        setParticipantChildren,
        gifts,
        setGifts,
        accessedViaParticipantCode,
        setAccessedViaParticipantCode
    } = useEvent();

    if (storageError) {
        return (
            <ErrorScreen
                error={storageError}
                onRetry={() => {
                    setStorageError(null);
                    window.location.reload();
                }}
            />
        );
    }

    switch (view) {
        case "home":
            return (
                <Home
                    setView={setView}
                    codigoAcesso={accessCode}
                    setCodigoAcesso={setAccessCode}
                    acessarEvento={fetchEventByCode}
                    recuperarPorCelular={retrieveParticipantByPhone}
                    recuperarEventoPorCelular={recoverParticipantInEvent}
                    loading={loading}
                    verified={!!currentUid}
                />
            );
        case "criar":
            return (
                <CriarEvento
                    setView={setView}
                    eventos={eventList}
                    setEventos={setEventList}
                    setEventoAtual={setCurrentEvent}
                    setPendingAdminEvent={setPendingAdminEvent}
                />
            );
        case "evento":
            return (
                <EventParticipant
                    eventoAtual={currentEvent}
                    setEventoAtual={setCurrentEvent}
                    eventos={eventList}
                    setEventos={setEventList}
                    setView={setView}
                    nomeParticipante={participantName}
                    setNomeParticipante={setParticipantName}
                    celular={participantMobileNumber}
                    setCelular={setParticipantMobileNumber}
                    filhos={participantChildren}
                    setFilhos={setParticipantChildren}
                    presentes={gifts}
                    setPresentes={setGifts}
                    loading={loading}
                    pendingAdminEvent={pendingAdminEvent}
                    setPendingAdminEvent={setPendingAdminEvent}
                    accessedViaParticipantCode={accessedViaParticipantCode}
                    setAccessedViaParticipantCode={setAccessedViaParticipantCode}
                />
            );
        case "admin":
            return (
                <AdminEvento
                    eventoAtual={currentEvent}
                    setEventoAtual={setCurrentEvent}
                    eventos={eventList}
                    setEventos={setEventList}
                    setView={setView}
                    loading={loading}
                />
            );
        case "resultado":
            return (
                <SecretSantaResults
                    eventoAtual={currentEvent}
                    setView={setView}
                    setEventoAtual={setCurrentEvent}
                    setCodigoAcesso={setAccessCode}
                />
            );
        default:
            return (
                <Home
                    setView={setView}
                    codigoAcesso={accessCode}
                    setCodigoAcesso={setAccessCode}
                    acessarEvento={fetchEventByCode}
                    recuperarPorCelular={retrieveParticipantByPhone}
                    recuperarEventoPorCelular={recoverParticipantInEvent}
                    loading={loading}
                    verified={!!currentUid}
                />
            );
    }
}
