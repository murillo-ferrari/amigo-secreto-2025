// src/utils/sorteio.js

export const realizarSorteio = async (eventoAtual, setEventoAtual, eventos, setEventos) => {
  // Conta total de participantes incluindo filhos
  let totalParticipantes = 0;
  eventoAtual.participantes.forEach(p => {
    totalParticipantes++;
    if (p.filhos && p.filhos.length > 0) {
      totalParticipantes += p.filhos.length;
    }
  });
  
  if (totalParticipantes < 2) {
    alert('Precisa de pelo menos 2 participantes no total (contando filhos)!');
    return;
  }
  
  // Cria lista de todos que vão tirar (incluindo filhos)
  const todosParticipantes = [];
  eventoAtual.participantes.forEach(p => {
    todosParticipantes.push({ nome: p.nome, responsavel: p.id });
    if (p.filhos && p.filhos.length > 0) {
      p.filhos.forEach(f => {
        todosParticipantes.push({ nome: f, responsavel: p.id });
      });
    }
  });
  
  console.log('Total de participantes:', todosParticipantes.length);
  console.log('Participantes:', todosParticipantes);
  
  // Verifica quantas famílias diferentes existem
  const familias = new Set(todosParticipantes.map(p => p.responsavel));
  
  if (familias.size < 2) {
    alert('Não é possível realizar o sorteio. Todos os participantes são da mesma família! Adicione participantes de outras famílias.');
    return;
  }
  
  // Algoritmo: Grafo bipartido + tentativa e erro otimizada
  const MAX_TENTATIVAS = 10000;
  let tentativas = 0;
  let sorteioValido = false;
  let sorteio = {};
  let melhorTentativa = null;
  let menorViolacoes = Infinity;
  
  while (tentativas < MAX_TENTATIVAS) {
    tentativas++;
    
    // Cria uma permutação aleatória
    const receptores = [...todosParticipantes].sort(() => Math.random() - 0.5);
    
    // Conta violações (mesma família ou si mesmo)
    let violacoes = 0;
    let violacaoSiMesmo = false;
    
    for (let i = 0; i < todosParticipantes.length; i++) {
      const doador = todosParticipantes[i];
      const receptor = receptores[i];
      
      // NUNCA pode tirar a si mesmo
      if (doador.nome === receptor.nome) {
        violacaoSiMesmo = true;
        violacoes += 100;
      }
      // Conta se é da mesma família
      else if (doador.responsavel === receptor.responsavel) {
        violacoes++;
      }
    }
    
    // Se não tirou a si mesmo e tem menos violações, guarda
    if (!violacaoSiMesmo && violacoes < menorViolacoes) {
      menorViolacoes = violacoes;
      melhorTentativa = {};
      for (let i = 0; i < todosParticipantes.length; i++) {
        melhorTentativa[todosParticipantes[i].nome] = receptores[i].nome;
      }
    }
    
    // Se encontrou solução perfeita (0 violações), para
    if (!violacaoSiMesmo && violacoes === 0) {
      sorteioValido = true;
      sorteio = melhorTentativa;
      break;
    }
  }
  
  console.log('Tentativas:', tentativas);
  console.log('Violações (mesma família):', menorViolacoes);
  
  // Se não encontrou solução perfeita, usa a melhor encontrada
  if (!sorteioValido && melhorTentativa && menorViolacoes < Infinity) {
    console.log('Usando melhor solução encontrada com', menorViolacoes, 'pessoa(s) tirando da mesma família');
    
    const confirmar = confirm(
      `Não foi possível encontrar um sorteio onde ninguém tira da própria família.\n\n` +
      `Encontrei uma solução onde ${menorViolacoes} pessoa(s) tirarão alguém da própria família (mas não a si mesmo).\n\n` +
      `Deseja usar essa solução?`
    );
    
    if (confirmar) {
      sorteio = melhorTentativa;
      sorteioValido = true;
    } else {
      return;
    }
  }
  
  if (!sorteioValido) {
    alert('Não foi possível realizar o sorteio. Tente adicionar mais participantes de famílias diferentes.');
    return;
  }
  
  console.log('Sorteio:', sorteio);
  
  const eventoAtualizado = {
    ...eventoAtual,
    sorteado: true,
    sorteio: sorteio,
    dataSorteio: new Date().toISOString()
  };
  
  try {
    await window.storage.set(`evento:${eventoAtual.codigo}`, JSON.stringify(eventoAtualizado));
    setEventoAtual(eventoAtualizado);
    setEventos({...eventos, [eventoAtual.codigo]: eventoAtualizado});
    alert('Sorteio realizado com sucesso!');
  } catch (error) {
    console.error('Erro ao salvar sorteio:', error);
    alert('Erro ao realizar sorteio. Tente novamente.');
  }
};