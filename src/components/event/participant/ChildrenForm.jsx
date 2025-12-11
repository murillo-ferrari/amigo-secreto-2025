import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export default function ChildrenForm({ childrenList, onUpdateChildren }) {
    const [childName, setChildName] = useState("");
    const [childrenNewGift, setChildrenNewGift] = useState({});

    const normalizeChild = (child) => {
        if (typeof child === "string") {
            return { name: child, gifts: [] };
        }
        return { name: child.name, gifts: child.gifts || [] };
    };

    const addParticipantChild = () => {
        if (!childName.trim()) return;

        onUpdateChildren([...childrenList, { name: childName.trim(), gifts: [] }]);
        setChildName("");
    };

    const removeParticipantChild = (index) => {
        onUpdateChildren(childrenList.filter((_, i) => i !== index));
    };

    const addChildGift = (childIndex) => {
        const giftValue = (childrenNewGift[childIndex] || "").trim();
        if (!giftValue) return;

        const updatedChildren = childrenList.map((child, i) => {
            if (i !== childIndex) return child;

            const normalized = normalizeChild(child);
            return {
                ...normalized,
                gifts: [...normalized.gifts, giftValue],
            };
        });

        onUpdateChildren(updatedChildren);
        setChildrenNewGift({ ...childrenNewGift, [childIndex]: "" });
    };

    const removeChildGift = (childIndex, giftIndex) => {
        const updatedChildren = childrenList.map((child, i) => {
            if (i !== childIndex) return child;
            if (typeof child === "string") return child;

            return {
                ...child,
                gifts: (child.gifts || []).filter((_, pi) => pi !== giftIndex),
            };
        });

        onUpdateChildren(updatedChildren);
    };

    return (
        <div className="flex flex-col gap-2 p-4 bg-red-50 rounded-lg border border-red-100">
            <h3 className="flex gap-2 items-center font-semibold text-gray-800">
                <span className="bg-red-100 p-1 rounded">🧒</span>
                Incluir Filhos
            </h3>
            <p className="text-sm text-gray-600">
                Adicione crianças que participarão do sorteio, mas não têm
                celular próprio
            </p>

            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Nome da criança"
                    value={childName}
                    onChange={(event) => setChildName(event.target.value)}
                    className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg"
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            addParticipantChild();
                        }
                    }}
                />
                <button
                    onClick={addParticipantChild}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition shrink-0"
                    title="Adicionar criança"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <div className="flex flex-col gap-2">
                {(() => {
                    const indices = (childrenList || []).map((_, i) => i);
                    const sortedIndices = indices.slice().sort((i, j) => {
                        const a = normalizeChild(childrenList[i]).name.toLowerCase();
                        const b = normalizeChild(childrenList[j]).name.toLowerCase();
                        return a.localeCompare(b, undefined, { sensitivity: "base" });
                    });
                    return sortedIndices.map((index) => {
                        const child = childrenList[index];
                        const childData = normalizeChild(child);
                        return (
                            <div
                                key={index}
                                className="flex flex-col gap-2 bg-white p-2 rounded border border-gray-200"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-red-800">
                                        {childData.name}
                                    </span>
                                    <button
                                        onClick={() => removeParticipantChild(index)}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-2 pl-2 border-l-2 border-red-100">
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            placeholder={`Sugestão de presente para ${childData.name}`}
                                            value={childrenNewGift[index] || ""}
                                            onChange={(event) =>
                                                setChildrenNewGift({
                                                    ...childrenNewGift,
                                                    [index]: event.target.value,
                                                })
                                            }
                                            className="flex-1 min-w-0 px-3 py-1 text-sm border border-gray-300 rounded"
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    addChildGift(index);
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => addChildGift(index)}
                                            className="text-red-500 hover:text-red-700 font-bold px-2 shrink-0"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <ul className="space-y-1">
                                        {childData.gifts.map((gift, gIndex) => (
                                            <li
                                                key={gIndex}
                                                className="text-sm text-gray-600 flex justify-between items-center bg-gray-50 px-2 py-1 rounded"
                                            >
                                                <span>{gift}</span>
                                                <button
                                                    onClick={() => removeChildGift(index, gIndex)}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    ×
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        );
                    });
                })()}
            </div>
        </div>
    );
}
