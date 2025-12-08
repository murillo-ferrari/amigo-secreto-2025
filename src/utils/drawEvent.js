import firebaseStorage from "../firebase";

export const performSecretSantaDraw = async (
  currentEvent,
  setCurrentEvent,
  events,
  setEvents,
  message
) => {
  // Respect event option to include children
  const includeChildren = currentEvent?.includeChildrenOption ?? true;

  // Check if there are at least 2 participants (depending on includeChildren)
  let totalParticipants = 0;
  currentEvent.participants.forEach((participant) => {
    totalParticipants++;
    if (
      includeChildren &&
      participant.children &&
      participant.children.length > 0
    ) {
      totalParticipants += participant.children.length;
    }
  });

  if (totalParticipants < 2) {
    const text = includeChildren
      ? "Precisa de pelo menos 2 participantes no total (contando filhos)!"
      : "Precisa de pelo menos 2 participantes no total!";
    if (message?.error) {
      message.error({ message: text });
    }

    if (!message?.error) {
      if (window.appMessage?.error) {
        window.appMessage.error({ message: text });
      } else {
        console.warn(text);
      }
    }
    return;
  }

  // Create a list of all participants (optionally including children) with their family identifier
  const participantsList = [];
  currentEvent.participants.forEach((participant) => {
    participantsList.push({
      name: participant.name,
      responsavel: participant.id,
    });
    if (
      includeChildren &&
      participant.children &&
      participant.children.length > 0
    ) {
      participant.children.forEach((participantChild) => {
        // filhos may be strings or objects { nome, presentes }
        const childName =
          typeof participantChild === "string"
            ? participantChild
            : participantChild && participantChild.name
            ? participantChild.name
            : String(participantChild);
        participantsList.push({ name: childName, responsavel: participant.id });
      });
    }
  });

  // console.log("Number of Participants:", participantsList.length);
  // console.log("Participants:", participantsList);

  // Check if there are at least 2 different families
  const uniqueFamilies = new Set(
    participantsList.map((participant) => participant.responsavel)
  );

  if (uniqueFamilies.size < 2) {
    const text =
      "Não é possível realizar o sorteio. Todos os participantes são da mesma família! Adicione participantes de outras famílias.";
    if (message?.error) {
      message.error({ message: text });
    }

    if (!message?.error) {
      if (window.appMessage?.error) {
        window.appMessage.error({ message: text });
      } else {
        console.warn(text);
      }
    }
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
      if (donorParticipant.name === selectedReceiver.name) {
        isSelfViolation = true;
        violationCount += 100;
      }

      // Check if drew from same family (only when not a self-violation)
      if (
        donorParticipant.name !== selectedReceiver.name &&
        donorParticipant.responsavel === selectedReceiver.responsavel
      ) {
        violationCount++;
      }
    }

    // if this attempt is better than previous best, save it
    if (!isSelfViolation && violationCount < lowestViolations) {
      lowestViolations = violationCount;
      bestAttempt = {};
      for (let i = 0; i < participantsList.length; i++) {
        bestAttempt[participantsList[i].name] = randomizedReceivers[i].name;
      }
    }

    // If found perfect solution (0 violations), stop
    if (!isSelfViolation && violationCount === 0) {
      isValidDraw = true;
      draw = bestAttempt;
      break;
    }
  }

  // console.log("Attempts:", attemptCount);
  // console.log("Violations (same family):", lowestViolations);

  // If no perfect solution found, use the best one found
  if (!isValidDraw && bestAttempt && lowestViolations < Infinity) {
    /* console.log(
      "Using best solution found with",
      lowestViolations,
      "person(s) drawing from the same family"
    );
 */
    const msg =
      `Não foi possível encontrar um sorteio onde ninguém tira da própria família.\n\n` +
      `Encontrei uma solução onde ${lowestViolations} pessoa(s) tirarão alguém da própria família (mas não a si mesmo).\n\n` +
      `Deseja usar essa solução?`;

    let userConfirmation = false;
    if (message?.confirm) {
      userConfirmation = await message.confirm({
        title: "Solução parcial encontrada",
        message: msg,
        confirmText: "Usar solução",
        cancelText: "Cancelar",
      });
    }

    // If the primary message.confirm is not available, try the global fallback.
    if (!message?.confirm) {
      if (window.appMessage?.confirm) {
        userConfirmation = await window.appMessage.confirm({
          title: "Solução parcial encontrada",
          message: msg,
          confirmText: "Usar solução",
          cancelText: "Cancelar",
        });
      } else {
        console.warn("Confirm required but no message system available:", msg);
        userConfirmation = false;
      }
    }

    if (userConfirmation) {
      draw = bestAttempt;
      isValidDraw = true;
    } else {
      return;
    }
  }

  if (!isValidDraw) {
    const text =
      "Não foi possível realizar o sorteio. Tente adicionar mais participantes de famílias diferentes.";
    if (message?.error) {
      message.error({ message: text });
    }

    if (!message?.error) {
      if (window.appMessage?.error) {
        window.appMessage.error({ message: text });
      } else {
        console.warn(text);
      }
    }
    return;
  }

  console.log("Draw:", draw);

  // Prepare event object for persistence. Ensure transient UI-only fields
  // (like `currentParticipant`) are not persisted to the DB.
  const { _currentParticipant, ...eventWithoutTransient } = currentEvent || {};
  const updatedEvent = {
    ...eventWithoutTransient,
    drawn: true,
    draw: draw,
    drawDate: Date.now(),
  };

  try {
    await firebaseStorage.set(
      `event:${currentEvent.code}`,
      JSON.stringify(updatedEvent)
    );
    setCurrentEvent(updatedEvent);
    setEvents({ ...events, [currentEvent.code]: updatedEvent });
    if (message?.success) {
      message.success({ message: "Sorteio realizado com sucesso!" });
    }

    if (!message?.success) {
      if (window.appMessage?.success) {
        window.appMessage.success({
          message: "Sorteio realizado com sucesso!",
        });
      } else {
        console.info("Sorteio realizado com sucesso!");
      }
    }
  } catch (error) {
    console.error("Erro ao salvar draw:", error);
    if (message?.error) {
      message.error({ message: "Erro ao realizar sorteio. Tente novamente." });
    }

    if (!message?.error) {
      if (window.appMessage?.error) {
        window.appMessage.error({
          message: "Erro ao realizar sorteio. Tente novamente.",
        });
      } else {
        console.error("Erro ao realizar sorteio. Tente novamente.");
      }
    }
  }
};
