import { createContext, useContext, useState, useEffect } from "react";
import firebaseStorage from "../firebase";
import eventService from "../services/eventService";
import { useMessage } from "../components/message/MessageContext";

const EventContext = createContext();

export const useEvent = () => {
    const context = useContext(EventContext);
    if (!context) {
        throw new Error("useEvent must be used within an EventProvider");
    }
    return context;
};

export const EventProvider = ({ children }) => {
    const [view, setView] = useState("home");
    const [eventList, setEventList] = useState({});
    const [currentEvent, setCurrentEvent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [storageError, setStorageError] = useState(null);
    const [accessCode, setAccessCode] = useState("");
    const [pendingAdminEvent, setPendingAdminEvent] = useState(null);
    const [accessedViaParticipantCode, setAccessedViaParticipantCode] = useState(false);
    const [currentUid, setCurrentUid] = useState(null);

    // Participant form states (kept here for persistence across view switches if needed)
    const [participantName, setParticipantName] = useState("");
    const [participantMobileNumber, setParticipantMobileNumber] = useState("");
    const [participantChildren, setParticipantChildren] = useState([]);
    const [gifts, setGifts] = useState([]);

    const message = useMessage();

    // Initialize Storage and Auth
    useEffect(() => {
        const initialize = async () => {
            try {
                if (firebaseStorage.initError) {
                    setStorageError(firebaseStorage.initError);
                    return;
                }
                await loadEvents();

                // Check URL params
                const urlQueryParams = new URLSearchParams(window.location.search);
                const codeParam = urlQueryParams.get("code");
                if (codeParam) {
                    await fetchEventByCode(codeParam);
                }
            } catch (error) {
                console.error("Error initializing:", error);
            }
        };

        initialize();

        // Auth Listener
        const unsubscribe = firebaseStorage.onAuthStateChanged((user) => {
            setCurrentUid(user ? user.uid : null);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const loadEvents = async () => {
        setLoading(true);
        try {
            const events = await eventService.listEvents();
            setEventList(events);
        } catch (error) {
            console.error("Error loading events:", error);
            setStorageError(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdminAccess = (foundEvent) => {
        setCurrentEvent(foundEvent);
        setView("admin");
        setAccessCode("");
    };

    const handleExistingParticipantWithDraw = (foundEvent, foundParticipant) => {
        setCurrentEvent({ ...foundEvent, participanteAtual: foundParticipant });
        setView("resultado");
        setAccessCode("");
        setAccessedViaParticipantCode(true);
    };

    const handleExistingParticipantNoDraw = (foundEvent, foundParticipant) => {
        setCurrentEvent({ ...foundEvent, participanteAtual: foundParticipant });
        setParticipantName(foundParticipant.nome);
        setParticipantMobileNumber(foundParticipant.celular);
        setParticipantChildren(foundParticipant.filhos || []);
        setGifts(foundParticipant.presentes || []);
        setView("evento");
        setAccessCode("");
        setAccessedViaParticipantCode(true);
    };

    const handleNewParticipant = (foundEvent) => {
        setCurrentEvent(foundEvent);
        setParticipantName("");
        setParticipantMobileNumber("");
        setParticipantChildren([]);
        setGifts([]);
        setView("evento");
        setAccessCode("");
        setAccessedViaParticipantCode(false);
    };

    const fetchEventByCode = async (codeArg) => {
        setLoading(true);
        const formattedCode = (codeArg || accessCode || "").toUpperCase();
        const cleanedMobile = (codeArg || accessCode || "").replace(/\D/g, "");

        // Phone recovery flow
        if (cleanedMobile && (cleanedMobile.length === 10 || cleanedMobile.length === 11)) {
            await retrieveParticipantByPhone(cleanedMobile);
            setLoading(false);
            return;
        }

        if (!formattedCode || formattedCode.trim() === "") {
            message.error({ message: "Informe o código do evento antes de acessar." });
            setLoading(false);
            return;
        }

        try {
            // 1. Try direct fetch
            const foundEvent = await eventService.getEventByCode(formattedCode);

            if (foundEvent) {
                setEventList((prev) => ({ ...prev, [foundEvent.codigo]: foundEvent }));
                handleNewParticipant(foundEvent);
                return;
            }

            // 2. Search in loaded events (for participant codes)
            const { foundEvent: searchEvent, foundParticipant } = await eventService.searchEventByParticipantCode(formattedCode, eventList);

            if (!searchEvent) {
                message.error({ message: "Código não encontrado! Se você está usando um código de participante, primeiro acesse usando o código do evento." });
                return;
            }

            // Check if admin (removed in original code, but logic structure remains)
            // Assuming no separate admin code for now based on original App.jsx comments

            if (foundParticipant && searchEvent.sorteado) {
                handleExistingParticipantWithDraw(searchEvent, foundParticipant);
                return;
            }

            if (foundParticipant) {
                handleExistingParticipantNoDraw(searchEvent, foundParticipant);
                return;
            }

            handleNewParticipant(searchEvent);

        } catch (error) {
            console.error("Error accessing event:", error);
            setStorageError(error);
        } finally {
            setLoading(false);
        }
    };

    const retrieveParticipantByPhone = async (mobileNumberInput) => {
        setLoading(true);
        try {
            const matches = await eventService.findEventsByPhone(mobileNumberInput);

            if (!matches || matches.length === 0) {
                // message.error({ message: "Nenhum evento encontrado para este número." }); // Optional: might want to show this
                return [];
            }

            if (matches.length === 1) {
                const { event: parsedEvent, participant } = matches[0];
                if (parsedEvent.sorteado) {
                    handleExistingParticipantWithDraw(parsedEvent, participant);
                } else {
                    handleExistingParticipantNoDraw(parsedEvent, participant);
                }
            }

            // If multiple matches, the UI (Home) will handle showing the list
            // We just return the matches here
            return matches;

        } catch (error) {
            console.error("Error recovering by phone:", error);
            setStorageError(error);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const recoverParticipantInEvent = async (eventCode, mobileNumberInput) => {
        setLoading(true);
        try {
            const cleanedMobileNumber = (mobileNumberInput || "").replace(/\D/g, "");
            const foundEvent = await eventService.getEventByCode(eventCode);

            if (!foundEvent) {
                message.error({ message: "Evento não encontrado." });
                return;
            }

            const participantsList = foundEvent.participantes || [];
            const participant = participantsList.find((p) =>
                eventService.matchesPhoneNumber(p.celular, cleanedMobileNumber)
            );

            if (!participant) {
                message.error({ message: "Participante não encontrado neste evento." });
                return;
            }

            if (foundEvent.sorteado) {
                handleExistingParticipantWithDraw(foundEvent, participant);
            } else {
                handleExistingParticipantNoDraw(foundEvent, participant);
            }
        } catch (error) {
            console.error("Error recovering participant in event:", error);
            setStorageError(error);
        } finally {
            setLoading(false);
        }
    };

    const value = {
        view,
        setView,
        eventList,
        setEventList,
        currentEvent,
        setCurrentEvent,
        loading,
        setLoading,
        storageError,
        setStorageError,
        accessCode,
        setAccessCode,
        pendingAdminEvent,
        setPendingAdminEvent,
        accessedViaParticipantCode,
        setAccessedViaParticipantCode,
        currentUid,
        participantName,
        setParticipantName,
        participantMobileNumber,
        setParticipantMobileNumber,
        participantChildren,
        setParticipantChildren,
        gifts,
        setGifts,
        fetchEventByCode,
        retrieveParticipantByPhone,
        recoverParticipantInEvent,
        loadEvents
    };

    return (
        <EventContext.Provider value={value}>
            {children}
        </EventContext.Provider>
    );
};
