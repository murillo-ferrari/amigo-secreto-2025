export const performSecretSantaDraw = async (
  currentEvent,
  setCurrentEvent,
  events,
  setEvents
) => {
  // Respect event option to include children
  const includeChildren = currentEvent?.incluirFilhos ?? true;

  // Check if there are at least 2 participants (depending on includeChildren)
  let totalParticipants = 0;
  currentEvent.participantes.forEach((p) => {
    totalParticipants++;
    if (includeChildren && p.filhos && p.filhos.length > 0) {
      totalParticipants += p.filhos.length;
    }
  });

  if (totalParticipants < 2) {
    alert(
      includeChildren
        ? "Precisa de pelo menos 2 participantes no total (contando filhos)!"
        : "Precisa de pelo menos 2 participantes no total!"
    );
    return;
  }

  // Create a list of all participants (optionally including children) with their family identifier
  const participantsList = [];
  currentEvent.participantes.forEach((p) => {
    participantsList.push({ nome: p.nome, responsavel: p.id });
    if (includeChildren && p.filhos && p.filhos.length > 0) {
      p.filhos.forEach((f) => {
        // filhos may be strings or objects { nome, presentes }
        const childName =
          typeof f === "string" ? f : f && f.nome ? f.nome : String(f);
        participantsList.push({ nome: childName, responsavel: p.id });
      });
    }
  });

  console.log("Number of Participants:", participantsList.length);
  console.log("Participants:", participantsList);

  // Check if there are at least 2 different families
  const uniqueFamilies = new Set(participantsList.map((p) => p.responsavel));

  if (uniqueFamilies.size < 2) {
    alert(
      "Não é possível realizar o sorteio. Todos os participantes são da mesma família! Adicione participantes de outras famílias."
    );
    return;
  }

  // Algorithm to perform the draw
  const MAX_ATTEMPTS = 10000;
  let attemptCount = 0;
  let isValidDraw = false;
  let draw = {};
  let bestAttempt = null;
  let lowestViolations = Infinity;

  while (attemptCount < MAX_ATTEMPTS) {
    attemptCount++;

    // Shuffle participants to create a random draw
    const randomizedReceivers = [...participantsList].sort(
      () => Math.random() - 0.5
    );

    // Count violations (same family or self)
    let violationCount = 0;
    let isSelfViolation = false;

    for (let i = 0; i < participantsList.length; i++) {
      const donorParticipant = participantsList[i];
      const selectedReceiver = randomizedReceivers[i];

      // Check if drew self
      if (donorParticipant.nome === selectedReceiver.nome) {
        isSelfViolation = true;
        violationCount += 100;
      }
      // Check if drew from same family
      else if (donorParticipant.responsavel === selectedReceiver.responsavel) {
        violationCount++;
      }
    }

    // if this attempt is better than previous best, save it
    if (!isSelfViolation && violationCount < lowestViolations) {
      lowestViolations = violationCount;
      bestAttempt = {};
      for (let i = 0; i < participantsList.length; i++) {
        bestAttempt[participantsList[i].nome] = randomizedReceivers[i].nome;
      }
    }

    // If found perfect solution (0 violations), stop
    if (!isSelfViolation && violationCount === 0) {
      isValidDraw = true;
      draw = bestAttempt;
      break;
    }
  }

  console.log("Attempts:", attemptCount);
  console.log("Violations (same family):", lowestViolations);

  // If no perfect solution found, use the best one found
  if (!isValidDraw && bestAttempt && lowestViolations < Infinity) {
    console.log(
      "Using best solution found with",
      lowestViolations,
      "person(s) drawing from the same family"
    );

    const userConfirmation = confirm(
      `Não foi possível encontrar um sorteio onde ninguém tira da própria família.\n\n` +
        `Encontrei uma solução onde ${lowestViolations} pessoa(s) tirarão alguém da própria família (mas não a si mesmo).\n\n` +
        `Deseja usar essa solução?`
    );

    if (userConfirmation) {
      draw = bestAttempt;
      isValidDraw = true;
    } else {
      return;
    }
  }

  if (!isValidDraw) {
    alert(
      "Não foi possível realizar o sorteio. Tente adicionar mais participantes de famílias diferentes."
    );
    return;
  }

  console.log("Draw:", draw);

  const updatedEvent = {
    ...currentEvent,
    sorteado: true,
    sorteio: draw,
    dataSorteio: new Date().toISOString(),
  };

  try {
    await window.storage.set(
      `evento:${currentEvent.codigo}`,
      JSON.stringify(updatedEvent)
    );
    setCurrentEvent(updatedEvent);
    setEvents({ ...events, [currentEvent.codigo]: updatedEvent });
    alert("Sorteio realizado com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar sorteio:", error);
    alert("Erro ao realizar sorteio. Tente novamente.");
  }
};
