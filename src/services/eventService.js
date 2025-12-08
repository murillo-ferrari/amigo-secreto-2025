import firebaseStorage from "../firebase";
import { normalizeAccessCode } from "../utils/helpers";

const eventService = {
  /**
   * List all events (cached/local or from storage if allowed)
   * Note: With security rules, listing all events might be restricted.
   */
  async listEvents() {
    try {
      const keysResult = await firebaseStorage.list("evento:");
      const loadedEvents = {};

      for (const key of keysResult.keys) {
        const result = await firebaseStorage.get(key);
        if (result) {
          loadedEvents[key.replace("evento:", "")] = JSON.parse(result.value);
        }
      }
      return loadedEvents;
    } catch (error) {
      if (error.message?.includes("Permission denied")) {
        console.warn("Event listing blocked by security rules (expected)");
        return {};
      }
      throw error;
    }
  },

  /**
   * Fetch a specific event by its code
   * @param {string} code
   */
  async getEventByCode(code) {
    const formattedCode = (code || "").toUpperCase();
    if (!formattedCode) throw new Error("Código inválido");

    const result = await firebaseStorage.get(`evento:${formattedCode}`);
    if (result) {
      return JSON.parse(result.value);
    }
    return null;
  },

  /**
   * Find participant in a list of participants
   */
  findParticipantByCode(eventParticipants, formattedCode) {
    if (!formattedCode) return null;
    const normalizedInput = normalizeAccessCode(formattedCode);
    return eventParticipants.find(
      (participant) =>
        normalizeAccessCode(participant.codigoAcesso) === normalizedInput
    );
  },

  /**
   * Search for an event using a participant code (searching across provided event list)
   */
  async searchEventByParticipantCode(formattedCode, eventList) {
    for (const event of Object.values(eventList)) {
      const eventParticipants = event.participantes || [];
      const foundParticipant = this.findParticipantByCode(
        eventParticipants,
        formattedCode
      );

      if (foundParticipant) {
        return { foundEvent: event, foundParticipant };
      }
    }
    return { foundEvent: null, foundParticipant: null };
  },

  /**
   * Helper to check if phone matches.
   * Supports both obfuscated (new) and plain (legacy) phone storage.
   * @param {object|string} participantOrPhone - Participant object or phone string
   * @param {string} inputPhone - Clean phone digits to match
   * @returns {boolean}
   */
  matchesPhoneNumber(participantOrPhone, inputPhone) {
    // If passed a participant object with celularHash, use that (fastest/most reliable)
    if (participantOrPhone && typeof participantOrPhone === "object") {
      const participant = participantOrPhone;
      // celularHash stores plain digits - use it for matching
      if (participant.celularHash) {
        const hash = participant.celularHash;
        return (
          hash === inputPhone ||
          hash.endsWith(inputPhone) ||
          inputPhone.endsWith(hash)
        );
      }
      // Fall back to celular field
      const stored = (participant.celular || "").replace(/\D/g, "");
      return (
        stored === inputPhone ||
        stored.endsWith(inputPhone) ||
        inputPhone.endsWith(stored)
      );
    }

    // Legacy: string phone passed directly (may be obfuscated or plain)
    const storedPhone = participantOrPhone;
    const cleanStored = (storedPhone || "").replace(/\D/g, "");
    return (
      cleanStored === inputPhone ||
      cleanStored.endsWith(inputPhone) ||
      inputPhone.endsWith(cleanStored)
    );
  },

  /**
   * Find events/participants by phone number
   */
  async findEventsByPhone(mobileNumber) {
    const cleanedMobileNumber = (mobileNumber || "").replace(/\D/g, "");
    if (!cleanedMobileNumber) return [];

    const matches = [];

    // 1. Try phone index
    if (firebaseStorage.getEventCodesByPhone) {
      try {
        const codes = await firebaseStorage.getEventCodesByPhone(
          cleanedMobileNumber
        );
        for (const eventCode of codes) {
          try {
            const result = await firebaseStorage.get(`evento:${eventCode}`);
            if (!result) continue;

            const event = JSON.parse(result.value);
            const participantsList = event.participantes || [];
            const participant = participantsList.find((participant) =>
              this.matchesPhoneNumber(participant, cleanedMobileNumber)
            );

            if (participant) {
              matches.push({ event, participant });
            } else {
              matches.push({ event, participant: null });
            }
          } catch (error) {
            console.warn(
              "Failed fetching event from index code:",
              eventCode,
              error
            );
          }
        }
      } catch (error) {
        console.warn("Phone index lookup failed:", error);
      }
    }

    return matches;
  },

  /**
   * Create or Update an event
   */
  async saveEvent(event) {
    if (!event || !event.codigo) throw new Error("Evento inválido");
    await firebaseStorage.set(`evento:${event.codigo}`, JSON.stringify(event));
    return event;
  },
};

export default eventService;
