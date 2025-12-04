import { useEffect, useState } from "react";
import ErrorScreen from "./components/common/ErrorScreen";
import AdminEvento from "./components/event/EventAdmin";
import CriarEvento from "./components/event/EventCreate";
import Home from "./components/event/EventHome";
import EventParticipant from "./components/event/EventParticipant";
import SecretSantaResults from "./components/event/EventResults";
import { validateHash } from "./utils/helpers";
import { useMessage } from "./components/message/MessageContext";

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
  const message = useMessage();

  useEffect(() => {
    const initializeStorage = async () => {
      try {
        if (window.storage?.initError) {
          setStorageError(window.storage.initError);
          return;
        }
      } catch (error) {
        console.error("Error checking storage/init:", error);
      }

      await loadEvents();

      try {
        const urlQueryParams = new URLSearchParams(window.location.search);
        const codeParam = urlQueryParams.get("code");
        if (codeParam) {
          await fetchEventByCode(codeParam);
        }
      } catch (error) {
        console.error("Error processing query params:", error);
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
      // With security rules, listing events may fail (Permission denied)
      // This is expected - users access events directly by code
      if (error.message?.includes("Permission denied")) {
        console.log("Event listing blocked by security rules (expected)");
        setEventList({});
      } else {
        console.log("Error loading events:", error);
        setStorageError(error);
      }
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
    // With security rules, we cannot list all events.
    // We only search in events already loaded in memory (eventList).
    for (const event of Object.values(eventList)) {
      const eventParticipants = event.participantes || [];

      const isAdmin = await checkAdminCode(formattedCode, event);
      if (isAdmin) {
        return {
          foundEvent: event,
          isAdmin: true,
          foundParticipant: null,
        };
      }

      const foundParticipant = findParticipantByCode(
        eventParticipants,
        formattedCode
      );
      if (foundParticipant) {
        return { foundEvent: event, isAdmin: false, foundParticipant };
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
    // Prevent empty code lookup which may trigger forbidden DB access
    if (!formattedCode || formattedCode.trim() === "") {
      message.error({ message: "Informe o código do evento antes de acessar." });
      setLoading(false);
      return;
    }

    try {
      // First try to fetch directly by event code
      const directResult = await window.storage.get(`evento:${formattedCode}`);
      let foundEvent = directResult ? JSON.parse(directResult.value) : null;
      let isAdmin = false;
      let foundParticipant = null;

      // If found directly by event code
      if (foundEvent) {
        // Add to memory for future searches
        setEventList((prev) => ({ ...prev, [foundEvent.codigo]: foundEvent }));
        // Event code entered - treat as new participant flow
        handleNewParticipant(foundEvent);
        return;
      }
      
      // If not found directly, the code might be admin or participant code
      // Search in in-memory events
      const searchResult = await searchEventByCode(formattedCode);
      
      if (!searchResult.foundEvent) {
        // Not found in memory - show helpful message
        message.error({ message: "Código não encontrado! Se você está usando um código de participante, primeiro acesse usando o código do evento." });
        return;
      }
      
      foundEvent = searchResult.foundEvent;
      isAdmin = searchResult.isAdmin;
      foundParticipant = searchResult.foundParticipant;

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

      // Fallback - shouldn't normally reach here
      handleNewParticipant(foundEvent);
    } catch (error) {
      console.error("Error accessing event:", error);
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
    // We'll collect all matching event/participant pairs (0..N)
    const matches = [];

    // First, try phone index which may return multiple event codes
    if (window.storage.getEventCodesByPhone || window.storage.getEventCodeByPhone) {
      try {
        let codes = [];
        if (window.storage.getEventCodesByPhone) {
          codes = await window.storage.getEventCodesByPhone(cleanedMobileNumber);
        } else if (window.storage.getEventCodeByPhone) {
          const single = await window.storage.getEventCodeByPhone(cleanedMobileNumber);
          if (single) codes = [single];
        }

        for (const eventCode of codes) {
          try {
            const result = await window.storage.get(`evento:${eventCode}`);
            if (!result) continue;
            const event = JSON.parse(result.value);
            const participantsList = event.participantes || [];
            const participant = participantsList.find((p) =>
              matchesPhoneNumber(p.celular, cleanedMobileNumber)
            );
            if (participant) {
              // Add to memory for future use
              setEventList((prev) => ({ ...prev, [event.codigo]: event }));
              matches.push({ event, participant });
            } else {
              // Even if participant not found, still add event as possible selection
              matches.push({ event, participant: null });
            }
          } catch (err) {
            console.warn("Failed fetching event from index code:", eventCode, err);
          }
        }
      } catch (error) {
        console.warn("Phone index lookup failed:", error);
      }
    }

    // Fallback: also search in-memory events (to catch cases not indexed)
    for (const event of Object.values(eventList)) {
      const participantsList = event.participantes || [];
      const participant = participantsList.find((p) =>
        matchesPhoneNumber(p.celular, cleanedMobileNumber)
      );
      // Avoid duplicates (by event.codigo)
      if (participant) {
        if (!matches.some((m) => m.event.codigo === event.codigo)) {
          matches.push({ event, participant });
        }
      }
    }

    return matches; // array possibly empty
  };

  const retrieveParticipantByPhone = async (mobileNumberInput) => {
    setLoading(true);
    try {
      const cleanedMobileNumber = (mobileNumberInput || "").replace(/\D/g, "");

      if (!cleanedMobileNumber) {
        message.error({ message: "Informe o celular (com DDD)" });
        return [];
      }

      const matches = await findParticipantByPhone(cleanedMobileNumber);

      if (!matches || matches.length === 0) {
        return [];
      }

      // If only one match, proceed with the previous behavior (navigate/show)
      if (matches.length === 1) {
        const { event: parsedEvent, participant } = matches[0];
        if (parsedEvent.sorteado) {
          handleExistingParticipantWithDraw(parsedEvent, participant);
          return matches;
        }

        handleExistingParticipantNoDraw(parsedEvent, participant);
        return matches;
      }

      // Multiple matches: return them to the caller to let UI choose
      return matches;
    } catch (error) {
      console.error("Error recovering by phone:", error);
      setStorageError(error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Recover a participant inside a specific event (used when user picks from multiple matches)
  const recoverParticipantInEvent = async (eventCode, mobileNumberInput) => {
    setLoading(true);
    try {
      const cleanedMobileNumber = (mobileNumberInput || "").replace(/\D/g, "");
      if (!cleanedMobileNumber) {
        message.error({ message: "Informe o celular (com DDD)" });
        return;
      }

      const result = await window.storage.get(`evento:${eventCode}`);
      if (!result) {
        message.error({ message: "Evento não encontrado." });
        return;
      }
      const parsedEvent = JSON.parse(result.value);
      const participantsList = parsedEvent.participantes || [];
      const participant = participantsList.find((p) =>
        matchesPhoneNumber(p.celular, cleanedMobileNumber)
      );

      if (!participant) {
        message.error({ message: "Participante não encontrado neste evento." });
        return;
      }

      if (parsedEvent.sorteado) {
        handleExistingParticipantWithDraw(parsedEvent, participant);
        return;
      }

      handleExistingParticipantNoDraw(parsedEvent, participant);
    } catch (error) {
      console.error("Error recovering participant in event:", error);
      setStorageError(error);
    } finally {
      setLoading(false);
    }
  };

  // Render different views based on current state
  let content = null;

  if (storageError) {
    content = (
      <ErrorScreen
        error={storageError}
        onRetry={() => {
          setStorageError(null);
          window.location.reload();
        }}
      />
    );
  } else if (view === "home") {
    content = (
      <Home
        setView={setView}
        codigoAcesso={accessCode}
        setCodigoAcesso={setAccessCode}
        acessarEvento={fetchEventByCode}
        recuperarPorCelular={retrieveParticipantByPhone}
        recuperarEventoPorCelular={recoverParticipantInEvent}
        loading={loading}
      />
    );
  } else if (view === "criar") {
    content = (
      <CriarEvento
        setView={setView}
        eventos={eventList}
        setEventos={setEventList}
        setEventoAtual={setCurrentEvent}
      />
    );
  } else if (view === "evento") {
    content = (
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
  } else if (view === "admin") {
    content = (
      <AdminEvento
        eventoAtual={currentEvent}
        setEventoAtual={setCurrentEvent}
        eventos={eventList}
        setEventos={setEventList}
        setView={setView}
        loading={loading}
      />
    );
  } else if (view === "resultado") {
    content = (
      <SecretSantaResults
        eventoAtual={currentEvent}
        setView={setView}
        setEventoAtual={setCurrentEvent}
        setCodigoAcesso={setAccessCode}
      />
    );
  }

  return content;
}
