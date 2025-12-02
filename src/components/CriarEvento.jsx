import React, { useState } from 'react';
import { gerarCodigo, hashCode } from '../utils/helpers';
import Header from './Header';
import Footer from './Footer';

export default function CriarEvento({ setView, eventos, setEventos, setEventoAtual }) {
  const [nomeEvento, setNomeEvento] = useState('');
  const [valorSugerido, setValorSugerido] = useState('');
  
  const criarEvento = async () => {
    if (!nomeEvento.trim()) {
      alert('Digite um nome para o evento!');
      return;
    }
    
    const codigo = gerarCodigo();
    const codigoAdmin = gerarCodigo();
    
    // Hash do código admin para armazenamento seguro
    const codigoAdminHash = await hashCode(codigoAdmin);
    
    const novoEvento = {
      nome: nomeEvento,
      valorSugerido: valorSugerido,
      codigo: codigo,
      codigoAdminHash: codigoAdminHash, // Armazena hash ao invés do código em texto
      codigoAdmin: codigoAdmin, // Mantém temporariamente para mostrar ao usuário
      participantes: [],
      sorteado: false,
      sorteio: {},
      dataCriacao: new Date().toISOString()
    };
    
    // Para salvar no Firebase, removemos o código admin em texto
    const eventoParaSalvar = { ...novoEvento };
    delete eventoParaSalvar.codigoAdmin;
    
    try {
      await window.storage.set(`evento:${codigo}`, JSON.stringify(eventoParaSalvar));
      setEventos({...eventos, [codigo]: novoEvento});
      setEventoAtual(novoEvento); // Mantém o código em texto para a sessão atual
      setNomeEvento('');
      setValorSugerido('');
      setView('admin');
    } catch (error) {
      alert('Erro ao criar evento. Tente novamente.', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-12">
        <Header />
        <button
          onClick={() => setView('home')}
          className="mb-4 text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Criar Evento</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Evento
              </label>
              <input
                type="text"
                placeholder="Ex: Amigo Secreto da Família 2024"
                value={nomeEvento}
                onChange={(e) => setNomeEvento(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor Sugerido (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: 50,00"
                value={valorSugerido}
                onChange={(e) => setValorSugerido(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <button
              onClick={criarEvento}
              className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
            >
              Criar Evento
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}