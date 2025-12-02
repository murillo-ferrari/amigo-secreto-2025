import { Gift } from 'lucide-react';

export default function Header() {
    return (
        <header className="text-center mb-8">
            <Gift className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Amigo Secreto</h1>
            <p className="text-gray-600">Organize seu amigo secreto de forma simples</p>
        </header>
    );
}