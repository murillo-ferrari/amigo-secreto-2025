import { Trash2, Users, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { calculateTotalParticipants } from "../../../utils/helpers";

export default function ParticipantListAdmin({
    participants,
    currentEvent,
    includeChildren,
    hasAnyFilhos,
    onRemoveParticipant,
    displayPhone,
}) {
    const [page, setPage] = useState(1);
    const pageSize = 5;
    const totalParticipants = participants.length;
    const totalPages = Math.max(1, Math.ceil(totalParticipants / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const isDrawn = !!currentEvent?.drawn;
    const [revealed, setRevealed] = useState({});

    const toggleReveal = (key) => {
        setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const safeName = (val) => {
        if (val == null) return "";
        if (typeof val === "string") return val;
        if (typeof val === "object" && val.name) return val.name;
        return String(val);
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-gray-800">
                    <Users className="w-5 h-5" />
                    Participantes (
                    {includeChildren
                        ? calculateTotalParticipants(participants)
                        : participants.length}
                    {includeChildren && hasAnyFilhos ? ", incluindo filhos" : ""})
                </h3>
                {isDrawn && (
                    <div>
                        {(() => {
                            const allKeys = [];
                            participants.forEach((pp) => {
                                allKeys.push(`${pp.id}::self`);
                                if (pp.children) {
                                    pp.children.forEach((c) => {
                                        const childName = typeof c === "string" ? c : c && c.name ? c.name : String(c);
                                        allKeys.push(`${pp.id}::child::${childName}`);
                                    });
                                }
                            });

                            const allRevealed = allKeys.length > 0 && allKeys.every((k) => !!revealed[k]);

                            const toggleRevealAll = () => {
                                const value = !allRevealed;
                                const newMap = {};
                                allKeys.forEach((k) => (newMap[k] = value));
                                setRevealed((prev) => ({ ...prev, ...newMap }));
                            };

                            return (
                                <button
                                    onClick={toggleRevealAll}
                                    className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2"
                                    title={allRevealed ? "Ocultar tudo" : "Revelar tudo"}
                                >
                                    {allRevealed ? <><EyeOff className="w-4 h-4" /> Ocultar tudo</> : <><Eye className="w-4 h-4" /> Revelar tudo</>}
                                </button>
                            );
                        })()}
                    </div>
                )}
            </div>

            {participants.length === 0 ? (
                <p className="text-gray-500 text-sm">
                    Nenhum participante ainda. Compartilhe o código {currentEvent.code}
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {(() => {
                        const start = (currentPage - 1) * pageSize;
                        const end = Math.min(start + pageSize, totalParticipants);
                        const pageItems = participants.slice(start, end);
                        return pageItems.map((participant) => (
                            <div key={participant.id} className="border border-gray-200 rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col flex-1">
                                        <p className="font-semibold text-gray-800">{participant.name}</p>
                                        <p className="text-sm text-gray-600">{displayPhone(participant)}</p>
                                        {participant.gifts && participant.gifts.length > 0 && participant.children && participant.children.length > 0 && (
                                            <div className="border-b border-gray-200 pb-2">
                                                <p className="text-sm text-gray-500">
                                                    Sugestões: {participant.gifts.join(", ")}
                                                </p>
                                            </div>
                                        )}
                                        {participant.children && participant.children.length > 0 && (
                                            <div className="pt-2">
                                                <p className="text-md font-semibold text-gray-700">Filhos:</p>
                                                <div className="pl-3 border-l-2 border-gray-200">
                                                    {(participant.children || [])
                                                        .slice()
                                                        .sort((a, b) => {
                                                            const aName = typeof a === 'string' ? a : a?.name || String(a);
                                                            const bName = typeof b === 'string' ? b : b?.name || String(b);
                                                            return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
                                                        })
                                                        .map((child, idx) => {
                                                            const name = typeof child === "string" ? child : child.name;
                                                            const gifts = (typeof child !== "string" && child.gifts) ? child.gifts : [];

                                                            return (
                                                                <div key={idx}>
                                                                    <p className="text-md font-medium text-gray-800">{name}</p>
                                                                    {gifts.length > 0 && (
                                                                        <p className="text-sm text-gray-500">
                                                                            Sugestões: {gifts.join(", ")}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!currentEvent.drawn &&
                                            // Do not allow deleting the admin participant
                                            ((currentEvent?.adminParticipantId || participant.isAdmin) &&
                                                (currentEvent.adminParticipantId === participant.id ||
                                                    participant.isAdmin) ? (
                                                <button
                                                    disabled
                                                    className="text-gray-300 cursor-not-allowed"
                                                    title="Não é possível excluir o administrador"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onRemoveParticipant(participant.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                    title="Excluir participante"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            ))}
                                    </div>
                                </div>

                                {isDrawn && (
                                    <div className="flex flex-col border-t pt-2">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm flex items-center gap-2">
                                                <strong>{participant.name}</strong> tirou
                                                {(() => {
                                                    const recipient = safeName(
                                                        currentEvent.draw?.[participant.name]
                                                    );
                                                    const key = `${participant.id}::self`;
                                                    const isRevealed = !!revealed[key];

                                                    return (
                                                        <span className="flex items-center gap-2">
                                                            <span
                                                                className={`${isRevealed ? "text-gray-800" : "text-gray-400"}`}
                                                                aria-hidden={!isRevealed}
                                                            >
                                                                {isRevealed ? <strong>{recipient}</strong> : "—"}
                                                            </span>
                                                            <button
                                                                onClick={() => toggleReveal(key)}
                                                                title={isRevealed ? "Ocultar" : "Revelar"}
                                                                className="text-gray-500 hover:text-gray-800"
                                                                aria-pressed={isRevealed}
                                                            >
                                                                {isRevealed ? (
                                                                    <EyeOff className="w-4 h-4" />
                                                                ) : (
                                                                    <Eye className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        </span>
                                                    );
                                                })()}
                                            </p>
                                        </div>
                                        {participant.children &&
                                            (participant.children || [])
                                                .slice()
                                                .sort((a, b) => {
                                                    const aName = typeof a === 'string' ? a : a?.name || String(a);
                                                    const bName = typeof b === 'string' ? b : b?.name || String(b);
                                                    return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
                                                })
                                                .map((child) => {
                                                    const childName =
                                                        typeof child === "string"
                                                            ? child
                                                            : child && child.name
                                                                ? child.name
                                                                : String(child);
                                                    const recipient = safeName(
                                                        currentEvent.draw?.[childName]
                                                    );
                                                    const key = `${participant.id}::child::${childName}`;
                                                    const isRevealed = !!revealed[key];

                                                    return (
                                                        <div
                                                            key={childName}
                                                            className="flex justify-between items-center"
                                                        >
                                                            <p className="pl-3 text-sm flex items-center gap-2">
                                                                <strong>{childName}</strong> tirou
                                                                <span
                                                                    className={`${isRevealed ? "text-gray-800" : "text-gray-400"}`}
                                                                    aria-hidden={!isRevealed}
                                                                >
                                                                    {isRevealed ? <strong>{recipient}</strong> : "—"}
                                                                </span>
                                                                <button
                                                                    onClick={() => toggleReveal(key)}
                                                                    title={isRevealed ? "Ocultar" : "Revelar"}
                                                                    className="text-gray-500 hover:text-gray-800"
                                                                    aria-pressed={isRevealed}
                                                                >
                                                                    {isRevealed ? (
                                                                        <EyeOff className="w-4 h-4" />
                                                                    ) : (
                                                                        <Eye className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                    </div>
                                )}
                            </div>
                        ));
                    })()}

                    {totalParticipants > pageSize && (
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mt-4">
                            <div className="text-sm text-gray-600">
                                Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalParticipants)}{" "}
                                - {Math.min(currentPage * pageSize, totalParticipants)} de{" "}
                                {totalParticipants}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1 rounded ${currentPage === 1
                                        ? "bg-gray-200 text-gray-400"
                                        : "bg-white border"
                                        }`}
                                >
                                    Anterior
                                </button>
                                <div className="text-sm text-gray-700">
                                    {page} / {totalPages}
                                </div>
                                <button
                                    onClick={() =>
                                        setPage((prev) => Math.min(totalPages, prev + 1))
                                    }
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1 rounded ${currentPage === totalPages
                                        ? "bg-gray-200 text-gray-400"
                                        : "bg-white border"
                                        }`}
                                >
                                    Próximo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
