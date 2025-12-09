import { Trash2, Users } from "lucide-react";
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

    const safeName = (val) => {
        if (val == null) return "";
        if (typeof val === "string") return val;
        if (typeof val === "object" && val.name) return val.name;
        return String(val);
    };

    return (
        <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Participantes (
                {includeChildren
                    ? calculateTotalParticipants(participants)
                    : participants.length}
                {includeChildren && hasAnyFilhos ? ", incluindo filhos" : ""})
            </h3>

            {participants.length === 0 ? (
                <p className="text-gray-500 text-sm">
                    Nenhum participante ainda. Compartilhe o código {currentEvent.code}
                </p>
            ) : (
                <div className="space-y-3">
                    {(() => {
                        const start = (currentPage - 1) * pageSize;
                        const end = Math.min(start + pageSize, totalParticipants);
                        const pageItems = participants.slice(start, end);
                        return pageItems.map((p) => (
                            <div key={p.id} className="border border-gray-200 rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-800">{p.name}</p>
                                        <p className="text-sm text-gray-600">{displayPhone(p)}</p>
                                        {p.gifts && p.gifts.length > 0 && p.children && p.children.length > 0 && (
                                            <div className="border-b border-gray-200 mb-2">
                                                <p className="text-sm text-gray-500 mb-2">
                                                    Sugestões: {p.gifts.join(", ")}
                                                </p>
                                            </div>
                                        )}
                                        {p.children && p.children.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-md font-semibold text-gray-700 mb-1">Filhos:</p>
                                                <div className="pl-3 border-l-2 border-gray-200 space-y-2">
                                                    {p.children.map((child, idx) => {
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
                                            ((currentEvent?.adminParticipantId || p.isAdmin) &&
                                                (currentEvent.adminParticipantId === p.id ||
                                                    p.isAdmin) ? (
                                                <button
                                                    disabled
                                                    className="text-gray-300 cursor-not-allowed"
                                                    title="Não é possível excluir o administrador"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onRemoveParticipant(p.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                    title="Excluir participante"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            ))}
                                    </div>
                                </div>

                                {isDrawn && (
                                    <div className="space-y-1 pt-2 border-t">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm">
                                                <strong>{p.name}</strong> tirou{" "}
                                                {safeName(currentEvent.draw[p.name])}
                                            </p>
                                        </div>
                                        {p.children &&
                                            p.children.map((filho) => {
                                                const childName =
                                                    typeof filho === "string"
                                                        ? filho
                                                        : filho && filho.name
                                                            ? filho.name
                                                            : String(filho);
                                                return (
                                                    <div
                                                        key={childName}
                                                        className="flex justify-between items-center"
                                                    >
                                                        <p className="text-sm">
                                                            <strong>{childName}</strong> tirou{" "}
                                                            {safeName(currentEvent.draw[childName])}
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
