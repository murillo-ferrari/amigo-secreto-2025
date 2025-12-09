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
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-100">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="bg-red-100 p-1 rounded">👶</span>
                Incluir Filhos/Dependentes
            </h3>
            <p className="text-sm text-gray-600 mb-4">
                Adicione filhos ou dependentes que participarão do sorteio mas não têm
                celular próprio.
            </p>

            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    placeholder="Nome da criança"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            addParticipantChild();
                        }
                    }}
                />
                <button
                    onClick={addParticipantChild}
                    className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition"
                    title="Adicionar criança"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-4">
                {childrenList.map((child, index) => {
                    const childData = normalizeChild(child);
                    return (
                        <div
                            key={index}
                            className="bg-white p-3 rounded border border-gray-200"
                        >
                            <div className="flex justify-between items-center mb-2">
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

                            <div className="pl-2 border-l-2 border-red-100">
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        placeholder={`Sugestão de presente para ${childData.name}`}
                                        value={childrenNewGift[index] || ""}
                                        onChange={(e) =>
                                            setChildrenNewGift({
                                                ...childrenNewGift,
                                                [index]: e.target.value,
                                            })
                                        }
                                        className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                addChildGift(index);
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => addChildGift(index)}
                                        className="text-red-500 hover:text-red-700 font-bold px-2"
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
                })}
            </div>
        </div>
    );
}
