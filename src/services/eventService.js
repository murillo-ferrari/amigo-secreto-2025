import firebaseStorage from "../firebase";
import { hashPhone, normalizeAccessCode, getPersistableEvent, deobfuscatePhone, isObfuscated } from "../utils/helpers";

const eventService = {
  /**
   * List all events (cached/local or from storage if allowed)
   * Note: With security rules, listing all events might be restricted.
   */
  async listEvents() {
    try {
      const keysResult = await firebaseStorage.list("event:");
      const loadedEvents = {};

      for (const key of keysResult.keys) {
        const result = await firebaseStorage.get(key);
        if (result) {
          loadedEvents[key.replace("event:", "")] = JSON.parse(result.value);
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

    const result = await firebaseStorage.get(`event:${formattedCode}`);
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
        normalizeAccessCode(participant.codeAcesso) === normalizedInput
    );
  },

  /**
   * Search for an event using a participant code (searching across provided event list)
   */
  async searchEventByParticipantCode(formattedCode, eventList) {
    for (const event of Object.values(eventList)) {
      const eventParticipants = event.participants || [];
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
   * Helper to check if phone matches using hash comparison.
   * Supports both hashed (new) and legacy phone storage.
   * @param {object|string} participantOrPhone - Participant object or phone string
   * @param {string} inputPhoneHash - Hash of the input phone to match
   * @returns {boolean}
   */
  matchesPhoneHash(participantOrPhone, inputPhoneHash) {
    // If passed a participant object with mobilePhoneHash, compare hashes
    if (participantOrPhone && typeof participantOrPhone === "object") {
      const participant = participantOrPhone;
      // mobilePhoneHash stores SHA-256 hash - direct comparison
      if (participant.mobilePhoneHash) {
        return participant.mobilePhoneHash === inputPhoneHash;
      }
      // No hash available - can't match securely
      return false;
    }
    return false;
  },

  /**
   * Find events/participants by phone number
   */
  async findEventsByPhone(mobileNumber) {
    const cleanedMobileNumber = (mobileNumber || "").replace(/\D/g, "");
    if (!cleanedMobileNumber) return [];

    // Hash the input phone for comparison
    const inputPhoneHash = await hashPhone(cleanedMobileNumber);
    const matches = [];

    // 1. Try phone index
    if (firebaseStorage.getEventCodesByPhone) {
      try {
        const codes = await firebaseStorage.getEventCodesByPhone(
          cleanedMobileNumber
        );
        for (const eventCode of codes) {
          try {
            const result = await firebaseStorage.get(`event:${eventCode}`);
            if (!result) continue;

            const event = JSON.parse(result.value);
            const participantsList = event.participants || [];
            
            // 1. Try to find by hash (fastest and most secure)
            let participant = participantsList.find((participant) =>
              this.matchesPhoneHash(participant, inputPhoneHash)
            );

            // 2. Fallback: Try to find by deobfuscating legacy phones (slower)
            if (!participant) {
              participant = participantsList.find((p) => {
                // Skip if it has a hash (should have matched above) or no phone
                if (p.mobilePhoneHash || !p.mobilePhone) return false;

                try {
                  let pDigits = "";
                  if (isObfuscated(p.mobilePhone)) {
                    // Deobfuscate using event code + participant ID
                    const key = event.code + p.id;
                    const clear = deobfuscatePhone(p.mobilePhone, key);
                    pDigits = clear.replace(/\D/g, "");
                  } else {
                    pDigits = p.mobilePhone.replace(/\D/g, "");
                  }
                  return pDigits === cleanedMobileNumber;
                } catch (e) {
                  return false;
                }
              });
            }

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
    if (!event || !event.code) throw new Error("Evento inválido");
    const persistable = getPersistableEvent(event);
    await firebaseStorage.set(
      `event:${event.code}`,
      JSON.stringify(persistable)
    );
    return event;
  },
};

export default eventService;
