import { useEffect, useState } from "react";
import ErrorScreen from "./components/common/ErrorScreen";
import AdminEvento from "./components/event/EventAdmin";
import CriarEvento from "./components/event/EventCreate";
import Home from "./components/event/EventHome";
import EventParticipant from "./components/event/EventParticipant";
import SecretSantaResults from "./components/event/EventResults";
import { validateHash } from "./utils/helpers";

/**
 * SecretSantaApp is the main component of the Secret Santa web app.
 * It handles app state and navigation between different views.
 */
export default function SecretSantaApp() {
  const [view, setView] = useState("home");
  const [eventList, setEventList] = useState({});
  const [currentEvent, setCurrentEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [accessCode, setAccessCode] = useState("");

  // Participant form states
  const [participantName, setParticipantName] = useState("");
  const [participantMobileNumber, setParticipantMobileNumber] = useState("");
  const [participantChildren, setParticipantChildren] = useState([]);
  const [gifts, setGifts] = useState([]);

  useEffect(() => {
    const initializeStorage = async () => {
      try {
        if (window.storage?.initError) {
          setStorageError(window.storage.initError);
          return;
        }
      } catch (error) {
        console.error("Erro ao verificar storage/init:", error);
      }

      await loadEvents();

      try {
        const urlQueryParams = new URLSearchParams(window.location.search);
        const codeParam = urlQueryParams.get("code");
        if (codeParam) {
          await fetchEventByCode(codeParam);
        }
      } catch (error) {
        console.error("Erro ao processar query params:", error);
      }
    };

    initializeStorage();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const keys = await window.storage.list("evento:");
      const loadedEvents = {};

      for (const key of keys.keys) {
        const result = await window.storage.get(key);
        if (result) {
          loadedEvents[key.replace("evento:", "")] = JSON.parse(result.value);
        }
      }
      setEventList(loadedEvents);
    } catch (error) {
      console.log("Nenhum evento encontrado ainda", error);
      setStorageError(error);
    } finally {
      setLoading(false);
    }
  };

  const checkAdminCode = async (formattedCode, parsedEvent) => {
    if (parsedEvent.codigoAdminHash) {
      return await validateHash(formattedCode, parsedEvent.codigoAdminHash);
    }
    return parsedEvent.codigoAdmin === formattedCode;
  };

  const findParticipantByCode = (eventParticipants, formattedCode) => {
    return eventParticipants.find((p) => p.codigoAcesso === formattedCode);
  };

  const searchEventByCode = async (formattedCode) => {
    const keys = await window.storage.list("evento:");

    for (const key of keys.keys) {
      const eventResult = await window.storage.get(key);
      if (!eventResult) continue;

      const parsedEvent = JSON.parse(eventResult.value);
      const eventParticipants = parsedEvent.participantes || [];

      const isAdmin = await checkAdminCode(formattedCode, parsedEvent);
      if (isAdmin) {
        return {
          foundEvent: parsedEvent,
          isAdmin: true,
          foundParticipant: null,
        };
      }

      const foundParticipant = findParticipantByCode(
        eventParticipants,
        formattedCode
      );
      if (foundParticipant) {
        return { foundEvent: parsedEvent, isAdmin: false, foundParticipant };
      }
    }

    return { foundEvent: null, isAdmin: false, foundParticipant: null };
  };

  const handleAdminAccess = (foundEvent, formattedCode) => {
    setCurrentEvent({ ...foundEvent, codigoAdmin: formattedCode });
    setView("admin");
    setAccessCode("");
  };

  const handleExistingParticipantWithDraw = (foundEvent, foundParticipant) => {
    setCurrentEvent({ ...foundEvent, participanteAtual: foundParticipant });
    setView("resultado");
    setAccessCode("");
  };

  const handleExistingParticipantNoDraw = (foundEvent, foundParticipant) => {
    setCurrentEvent(foundEvent);
    setParticipantName(foundParticipant.nome);
    setParticipantMobileNumber(foundParticipant.celular);
    setParticipantChildren(foundParticipant.filhos || []);
    setGifts(foundParticipant.presentes || []);
    setView("evento");
    setAccessCode("");
  };

  const handleNewParticipant = (foundEvent) => {
    setCurrentEvent(foundEvent);
    setParticipantName("");
    setParticipantMobileNumber("");
    setParticipantChildren([]);
    setGifts([]);
    setView("evento");
    setAccessCode("");
  };

  const fetchEventByCode = async (codeArg) => {
    setLoading(true);
    const formattedCode = (codeArg || accessCode || "").toUpperCase();

    try {
      const directResult = await window.storage.get(`evento:${formattedCode}`);
      let foundEvent = directResult ? JSON.parse(directResult.value) : null;
      let isAdmin = false;
      let foundParticipant = null;

      if (!foundEvent) {
        const searchResult = await searchEventByCode(formattedCode);
        foundEvent = searchResult.foundEvent;
        isAdmin = searchResult.isAdmin;
        foundParticipant = searchResult.foundParticipant;
      }

      if (!foundEvent) {
        alert("Código não encontrado!");
        return;
      }

      if (isAdmin) {
        handleAdminAccess(foundEvent, formattedCode);
        return;
      }

      if (foundParticipant && foundEvent.sorteado) {
        handleExistingParticipantWithDraw(foundEvent, foundParticipant);
        return;
      }

      if (foundParticipant) {
        handleExistingParticipantNoDraw(foundEvent, foundParticipant);
        return;
      }

      handleNewParticipant(foundEvent);
    } catch (error) {
      console.error("Erro ao acessar evento:", error);
      setStorageError(error);
    } finally {
      setLoading(false);
    }
  };

  const matchesPhoneNumber = (storedPhone, inputPhone) => {
    const cleanStored = (storedPhone || "").replace(/\D/g, "");
    return (
      cleanStored === inputPhone ||
      cleanStored.endsWith(inputPhone) ||
      inputPhone.endsWith(cleanStored)
    );
  };

  const findParticipantByPhone = async (cleanedMobileNumber) => {
    const keys = await window.storage.list("evento:");

    for (const key of keys.keys) {
      const fetchedEvent = await window.storage.get(key);
      if (!fetchedEvent) continue;

      const parsedEvent = JSON.parse(fetchedEvent.value);
      const participantsList = parsedEvent.participantes || [];

      const participant = participantsList.find((p) =>
        matchesPhoneNumber(p.celular, cleanedMobileNumber)
      );

      if (participant) {
        return { event: parsedEvent, participant };
      }
    }

    return null;
  };

  const retrieveParticipantByPhone = async (mobileNumberInput) => {
    setLoading(true);

    try {
      const cleanedMobileNumber = (mobileNumberInput || "").replace(/\D/g, "");

      if (!cleanedMobileNumber) {
        alert("Informe o celular (com DDD)");
        return;
      }

      const result = await findParticipantByPhone(cleanedMobileNumber);

      if (!result) {
        alert("Celular não encontrado. Verifique o número e tente novamente.");
        return;
      }

      const { event: parsedEvent, participant } = result;

      if (parsedEvent.sorteado) {
        handleExistingParticipantWithDraw(parsedEvent, participant);
        return;
      }

      handleExistingParticipantNoDraw(parsedEvent, participant);
    } catch (error) {
      console.error("Erro ao recuperar por celular:", error);
      setStorageError(error);
    } finally {
      setLoading(false);
    }
  };

  // Render different views based on current state
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

  if (view === "home") {
    return (
      <Home
        setView={setView}
        codigoAcesso={accessCode}
        setCodigoAcesso={setAccessCode}
        acessarEvento={fetchEventByCode}
        recuperarPorCelular={retrieveParticipantByPhone}
        loading={loading}
      />
    );
  }

  if (view === "criar") {
    return (
      <CriarEvento
        setView={setView}
        eventos={eventList}
        setEventos={setEventList}
        setEventoAtual={setCurrentEvent}
      />
    );
  }

  if (view === "evento") {
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
      />
    );
  }

  if (view === "admin") {
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
  }

  if (view === "resultado") {
    return (
      <SecretSantaResults
        eventoAtual={currentEvent}
        setView={setView}
        setEventoAtual={setCurrentEvent}
        setCodigoAcesso={setAccessCode}
      />
    );
  }

  return null;
}
