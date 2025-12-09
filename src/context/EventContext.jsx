import { createContext, useContext, useEffect, useState } from "react";
import { useMessage } from "../components/message/MessageContext";
import firebaseStorage from "../firebase";
import eventService from "../services/eventService";
import { deobfuscatePhone, formatMobileNumber, hashPhone, isObfuscated } from "../utils/helpers";

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
                // Removed loadEvents() as listing is restricted by security rules.
                // We rely on direct lookups by code.

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

    const _handleAdminAccess = (foundEvent) => {
        setCurrentEvent(foundEvent);
        setView("admin");
        setAccessCode("");
    };

    const handleExistingParticipantWithDraw = (foundEvent, foundParticipant) => {
        setCurrentEvent({ ...foundEvent, currentParticipant: foundParticipant });
        setView("resultado");
        setAccessCode("");
        setAccessedViaParticipantCode(true);
    };

    const handleExistingParticipantNoDraw = (foundEvent, foundParticipant) => {
        setCurrentEvent({ ...foundEvent, currentParticipant: foundParticipant });
        setParticipantName(foundParticipant.name);

        // Deobfuscate phone for display in form
        let phoneForDisplay = foundParticipant.mobilePhone || "";
        if (isObfuscated(phoneForDisplay)) {
            const key = (foundEvent?.code || "") + foundParticipant.id;
            const deobfuscated = deobfuscatePhone(phoneForDisplay, key);
            phoneForDisplay = formatMobileNumber(deobfuscated);
        }
        setParticipantMobileNumber(phoneForDisplay);

        setParticipantChildren(foundParticipant.children || []);
        setGifts(foundParticipant.gifts || []);
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
                setEventList((prev) => ({ ...prev, [foundEvent.code]: foundEvent }));
                handleNewParticipant(foundEvent);
                return;
            }

            message.error({ message: "Evento não encontrado. Verifique o código e tente novamente." });

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
                if (parsedEvent.drawn) {
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

            // Hash the input phone for comparison
            const inputPhoneHash = await hashPhone(cleanedMobileNumber);
            const participantsList = foundEvent.participants || [];
            const participant = participantsList.find((p) =>
                eventService.matchesPhoneHash(p, inputPhoneHash)
            );

            if (!participant) {
                message.error({ message: "Participante não encontrado neste evento." });
                return;
            }

            if (foundEvent.drawn) {
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
        recoverParticipantInEvent
    };

    return (
        <EventContext.Provider value={value}>
            {children}
        </EventContext.Provider>
    );
};
