// Generates a unique 6-character alphanumeric code
export const createUniqueCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Formats a Brazilian mobile number as (XX) XXXXX-XXXX
export const formatMobileNumber = (valor) => {
  const cleanedValue = valor.replace(/\D/g, "");

  if (cleanedValue.length <= 2) {
    return cleanedValue;
  } else if (cleanedValue.length <= 7) {
    return `(${cleanedValue.slice(0, 2)}) ${cleanedValue.slice(2)}`;
  } else if (cleanedValue.length <= 11) {
    return `(${cleanedValue.slice(0, 2)}) ${cleanedValue.slice(
      2,
      7
    )}-${cleanedValue.slice(7, 11)}`;
  } else {
    return `(${cleanedValue.slice(0, 2)}) ${cleanedValue.slice(
      2,
      7
    )}-${cleanedValue.slice(7, 11)}`;
  }
};

// Validates Brazilian mobile number (must have 10 or 11 digits)
export const verifyMobileNumber = (celular) => {
  const formattedNumbers = celular.replace(/\D/g, "");

  // Must be 10 or 11 digits long.
  if (formattedNumbers.length < 10 || formattedNumbers.length > 11) {
    return { isValid: false, errorMessage: "Celular deve ter 10 ou 11 dígitos" };
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
    return total + 1 + (p.filhos && p.filhos.length ? p.filhos.length : 0);
  }, 0);
};

// Gera URL do WhatsApp com mensagem
/* export const gerarLinkWhatsApp = (nome, amigo, celular, nomeEvento, valorSugerido) => {
  const mensagem = `🎁 *Amigo Secreto - ${nomeEvento}*\n\n` +
                  `Olá ${nome}!\n\n` +
                  `Seu amigo secreto é: *${amigo}*\n\n` +
                  (valorSugerido ? `Valor sugerido: R$ ${valorSugerido}\n\n` : '') +
                  `Boas compras! 🎉`;
  
  return `https://wa.me/${celular.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`;
}; */

// Simple hash for codes (SHA-256)
export const hashCode = async (code) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
};

// Verifies if a code matches a hash
export const validateHash = async (code, hash) => {
  const codeHash = await hashCode(code);
  return codeHash === hash;
};
