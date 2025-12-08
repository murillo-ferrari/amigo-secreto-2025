// Generates a unique 6-character alphanumeric code
export const createUniqueCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Formats a Brazilian mobile number as (XX) XXXXX-XXXX
export const formatMobileNumber = (valor) => {
  const cleanedValue = valor.replace(/\D/g, "");
  if (cleanedValue.length <= 2) {
    return cleanedValue;
  }

  if (cleanedValue.length <= 7) {
    return `(${cleanedValue.slice(0, 2)}) ${cleanedValue.slice(2)}`;
  }

  if (cleanedValue.length <= 11) {
    return `(${cleanedValue.slice(0, 2)}) ${cleanedValue.slice(
      2,
      7
    )}-${cleanedValue.slice(7, 11)}`;
  }

  return `(${cleanedValue.slice(0, 2)}) ${cleanedValue.slice(
    2,
    7
  )}-${cleanedValue.slice(7, 11)}`;
};

// Validates Brazilian mobile number (must have 10 or 11 digits)
export const verifyMobileNumber = (celular) => {
  const formattedNumbers = celular.replace(/\D/g, "");

  // Must be 10 or 11 digits long.
  if (formattedNumbers.length < 10 || formattedNumbers.length > 11) {
    return {
      isValid: false,
      errorMessage: "Celular deve ter 10 ou 11 dígitos",
    };
  }

  // DDD must be valid (11-99)
  const ddd = parseInt(formattedNumbers.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return { isValid: false, errorMessage: "DDD inválido" };
  }

  // If 11 digits, the third digit must be 9
  if (formattedNumbers.length === 11 && formattedNumbers[2] !== "9") {
    return { isValid: false, errorMessage: "Número de celular inválido" };
  }

  return { isValid: true, errorMessage: null };
};

// Counts total participants including children
export const calculateTotalParticipants = (participants) => {
  if (!participants || !Array.isArray(participants)) {
    return 0;
  }
  return participants.reduce((total, p) => {
    return total + 1 + (p.children && p.children.length ? p.children.length : 0);
  }, 0);
};

// Normalize an access code for comparison/storage:
// - If the value contains digits (phone), return digits-only string
// - Otherwise return uppercased string
export const normalizeAccessCode = (val) => {
  if (!val) return "";
  const digits = String(val).replace(/\D/g, "");
  if (digits.length >= 8) return digits; // likely a phone
  return String(val).toUpperCase();
};
// Gera URL do WhatsApp com mensagem
/* export const gerarLinkWhatsApp = (nome, amigo, celular, nomeEvento, suggestedValue) => {
  const mensagem = `🎁 *Amigo Secreto - ${nomeEvento}*\n\n` +
                  `Olá ${nome}!\n\n` +
                  `Seu amigo secreto é: *${amigo}*\n\n` +
                  (suggestedValue ? `Valor sugerido: R$ ${suggestedValue}\n\n` : '') +
                  `Boas compras! 🎉`;
  
  return `https://wa.me/${celular.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`;
}; */

// Re-export crypto utilities for convenience
export {
  deobfuscatePhone, hashPhone, isObfuscated, maskPhone, obfuscatePhone
} from "./crypto.js";

/**
 * Return a shallow copy of the event object with transient UI-only fields removed.
 * Use this before persisting the full event object to storage.
 */
export const getPersistableEvent = (eventObj) => {
  if (!eventObj || typeof eventObj !== "object") return eventObj;
  const {
    currentParticipant,
    // future transient keys can be listed here
    ...rest
  } = eventObj;
  return rest;
};
