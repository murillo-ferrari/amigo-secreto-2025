import React from 'react';
import { Gift } from 'lucide-react';
import Footer from './Footer';
import RecuperarCodigo from './RecuperarCodigo';

export default function Home({ setView, codigoAcesso, setCodigoAcesso, acessarEvento, recuperarPorCelular, loading }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-12">
        <div className="text-center mb-8">
          <Gift className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Amigo Secreto</h1>
          <p className="text-gray-600">Organize seu amigo secreto de forma simples</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
          <button
            onClick={() => setView('criar')}
            className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
          >
            Criar Novo Evento
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">ou</span>
            </div>
          </div>
          
          <div>
            <input
              type="text"
              placeholder="Digite o código do evento"
              value={codigoAcesso}
              onChange={(e) => setCodigoAcesso(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-3"
            />
            <button
              onClick={acessarEvento}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              {loading ? 'Carregando...' : 'Acessar Evento'}
            </button>

            <RecuperarCodigo recuperarPorCelular={recuperarPorCelular} loading={loading} />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}