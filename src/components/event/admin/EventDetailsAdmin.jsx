import { Settings } from "lucide-react";
import { useState } from "react";
import QRCodeCard from "../eventQRCode";

export default function EventDetailsAdmin({
    currentEvent,
    isDrawn,
    onSave,
    onUpdateIncludeChildren,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editValue, setEditValue] = useState("");
    const [editPlannedDrawDate, setEditPlannedDrawDate] = useState("");
    const includeChildren = currentEvent?.includeChildrenOption ?? true;

    const startEditing = () => {
        setEditName(currentEvent?.name || "");
        setEditValue(currentEvent?.suggestedValue || "");
        setEditPlannedDrawDate(
            currentEvent?.plannedDrawDate
                ? new Date(currentEvent.plannedDrawDate).toISOString().split("T")[0]
                : ""
        );
        setIsEditing(true);
    };

    const cancelEdit = () => {
        setIsEditing(false);
    };

    const handleSave = () => {
        onSave({
            name: editName,
            suggestedValue: editValue,
            plannedDrawDate: editPlannedDrawDate,
        }).then((success) => {
            if (success) setIsEditing(false);
        });
    };

    return (
        <div className="flex flex-col bg-white p-2">
            <p className="text-2xl text-gray-800 font-bold mb-2">
                Painel de Administração
            </p>

            <div className="mb-4 bg-gray-100 border-l-4 border-gray-500 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 mb-3">
                        Detalhes do Evento
                    </h3>
                    {!isEditing ? (
                        <button
                            onClick={startEditing}
                            className="text-sm bg-gray-50 border px-3 py-1 rounded hover:bg-gray-100"
                            aria-label="Editar Evento"
                            title="Editar Evento"
                        >
                            <Settings aria-hidden="true" />
                        </button>
                    ) : null}
                </div>

                {!isEditing ? (
                    <div className="text-sm text-gray-600">
                        <p className="mb-1">
                            <strong>Nome:</strong> {currentEvent.name}
                        </p>
                        <p className="mb-1">
                            <strong>Valor sugerido:</strong>{" "}
                            {currentEvent.suggestedValue
                                ? `R$ ${currentEvent.suggestedValue}`
                                : "—"}
                        </p>
                        <p>
                            <strong>{currentEvent.drawDate ? "Sorteio realizado em" : "Data Prevista do Sorteio"}:</strong>{" "}
                            {currentEvent.drawDate ? (
                                new Date(currentEvent.drawDate).toLocaleDateString("pt-BR")
                            ) : currentEvent.plannedDrawDate ? (
                                new Date(currentEvent.plannedDrawDate).toLocaleDateString("pt-BR")
                            ) : (
                                "—"
                            )}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid md:grid-cols-2 gap-3 items-end">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                    <strong>Nome:</strong>
                                </label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                    <strong>Valor sugerido:</strong>
                                </label>
                                <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                    <strong>Data do sorteio:</strong>
                                </label>
                                <input
                                    type="date"
                                    value={editPlannedDrawDate}
                                    onChange={(e) => setEditPlannedDrawDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                            </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={handleSave}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                            >
                                Salvar alterações
                            </button>
                            <button
                                onClick={cancelEdit}
                                className="bg-white border px-4 py-2 rounded hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </>
                )}
                <div className="mt-4">
                    <label className="inline-flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={includeChildren}
                            onChange={(e) => onUpdateIncludeChildren(e.target.checked)}
                            disabled={isDrawn}
                        />
                        <span className="text-sm text-gray-700">
                            Incluir filhos (sem celular)
                        </span>
                    </label>
                    {isDrawn && (
                        <p className="text-xs text-gray-500 mt-1">
                            Não é possível alterar após o sorteio.
                        </p>
                    )}
                </div>
            </div>

            <div className="mb-4">
                <div className="flex justify-center">
                    <QRCodeCard
                        url={`${window.location.origin}?code=${currentEvent.code}`}
                        label="Link para convidar"
                        size={128}
                        eventName={currentEvent.name}
                    />
                </div>
            </div>
        </div>
    );
}
