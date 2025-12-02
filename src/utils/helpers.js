// Gera código aleatório de 6 caracteres
export const gerarCodigo = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Formata número de celular para (11) 99999-9999
export const formatarCelular = (valor) => {
  const numeros = valor.replace(/\D/g, '');
  
  if (numeros.length <= 2) {
    return numeros;
  } else if (numeros.length <= 7) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  } else if (numeros.length <= 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
  } else {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
  }
};

// Valida número de celular brasileiro (deve ter 10 ou 11 dígitos)
export const validarCelular = (celular) => {
  const numeros = celular.replace(/\D/g, '');
  
  // Deve ter 10 ou 11 dígitos (com ou sem 9 inicial)
  if (numeros.length < 10 || numeros.length > 11) {
    return { valido: false, erro: 'Celular deve ter 10 ou 11 dígitos' };
  }
  
  // DDD deve ser válido (11-99)
  const ddd = parseInt(numeros.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return { valido: false, erro: 'DDD inválido' };
  }
  
  // Se tem 11 dígitos, o terceiro deve ser 9 (celular)
  if (numeros.length === 11 && numeros[2] !== '9') {
    return { valido: false, erro: 'Número de celular inválido' };
  }
  
  return { valido: true, erro: null };
};

// Conta total de participantes incluindo filhos
export const contarTotalParticipantes = (participantes) => {
  if (!participantes || !Array.isArray(participantes)) {
    return 0;
  }
  return participantes.reduce((total, p) => {
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

// Hash simples para códigos (SHA-256)
export const hashCode = async (code) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

// Verifica se um código corresponde a um hash
export const verificarHash = async (code, hash) => {
  const codeHash = await hashCode(code);
  return codeHash === hash;
};