import { Shuffle, Trash, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { performSecretSantaDraw } from '../../utils/drawEvent';
import { calculateTotalParticipants } from '../../utils/helpers';
import CopyButton from '../common/CopyButton';
import Spinner from '../common/Spinner';
import Footer from '../layout/Footer';
import Header from '../layout/Header';

export default function AdminEvento({
  eventoAtual,
  setEventoAtual,
  eventos,
  setEventos,
  setView,
  loading
}) {
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const participantes = eventoAtual?.participantes || [];
  const totalParticipants = participantes.length;
  const hasAnyFilhos = participantes.some(p => p.filhos && p.filhos.length > 0);
  const totalPages = Math.max(1, Math.ceil(totalParticipants / pageSize));
  const sorteado = !!eventoAtual?.sorteado;

  // Avoid calling setState synchronously in an effect (can trigger cascading renders).
  // Instead derive the effective page to render from state and bounds.
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const safeName = (val) => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val.nome) return val.nome;
    return String(val);
  };

  const excluirParticipante = async (participanteId) => {
    if (!confirm('Tem certeza que deseja excluir este participante?')) {
      return;
    }

    const eventoAtualizado = {
      ...eventoAtual,
      participantes: (eventoAtual.participantes || []).filter(p => p.id !== participanteId),
      sorteado: false,
      sorteio: {}
    };

    try {
      await window.storage.set(`evento:${eventoAtual.codigo}`, JSON.stringify(eventoAtualizado));
      setEventoAtual(eventoAtualizado);
      setEventos({ ...eventos, [eventoAtual.codigo]: eventoAtualizado });
    } catch (error) {
      alert('Erro ao excluir participante. Tente novamente.', error);
    }
  };

  const excluirSorteio = async () => {
    if (!confirm('Tem certeza que deseja excluir o sorteio atual? Isso permitirá realizar um novo sorteio.')) {
      return;
    }

    const eventoAtualizado = {
      ...eventoAtual,
      sorteado: false,
      sorteio: {},
      dataSorteio: null
    };

    try {
      await window.storage.set(`evento:${eventoAtual.codigo}`, JSON.stringify(eventoAtualizado));
      setEventoAtual(eventoAtualizado);
      setEventos({ ...eventos, [eventoAtual.codigo]: eventoAtualizado });
      alert('Sorteio excluído com sucesso!');
    } catch (error) {
      alert('Erro ao excluir sorteio. Tente novamente.', error);
    }
  };

  const refazerSorteio = async () => {
    if (!confirm('Tem certeza que deseja refazer o sorteio? O sorteio anterior será descartado.')) {
      return;
    }

    await performSecretSantaDraw(eventoAtual, setEventoAtual, eventos, setEventos);
  };

  const excluirEvento = async (eventoCodigo) => {
    if (!confirm('Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await window.storage.delete(`evento:${eventoCodigo}`);
      const eventosAtualizados = { ...eventos };
      delete eventosAtualizados[eventoCodigo];
      setEventos(eventosAtualizados);
      alert('Evento excluído com sucesso!');
    } catch (error) {
      alert('Erro ao excluir evento. Tente novamente', error);
    }
  };

  /*  const enviarWhatsApp = (nome, amigo, celular) => {
     const url = gerarLinkWhatsApp(nome, amigo, celular, eventoAtual.nome, eventoAtual.valorSugerido);
     window.open(url, '_blank');
   }; */

  if (loading || !eventoAtual) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-2xl mx-auto pt-12">
        <Header />
        <button
          onClick={() => setView('home')}
          className="mb-4 text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{eventoAtual.nome}</h2>
          <p className="text-gray-600 mb-6">Painel de Administração</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Código Participantes</p>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-blue-600">{eventoAtual.codigo}</p>
                <CopyButton text={eventoAtual.codigo} className="ml-2" />
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Código Admin</p>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-purple-600">{eventoAtual.codigoAdmin}</p>
                <CopyButton text={eventoAtual.codigoAdmin || ''} className="ml-2" />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Participantes ({calculateTotalParticipants(participantes)}{hasAnyFilhos ? ', incluindo filhos' : ''})
            </h3>

            {participantes.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum participante ainda. Compartilhe o código {eventoAtual.codigo}</p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const start = (currentPage - 1) * pageSize;
                  const end = Math.min(start + pageSize, totalParticipants);
                  const pageItems = participantes.slice(start, end);
                  return pageItems.map(p => (
                    <div key={p.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{p.nome}</p>
                          <p className="text-sm text-gray-600">{p.celular}</p>
                          {p.filhos && p.filhos.length > 0 && (
                            <div>
                              <p className="text-sm text-gray-500">Filhos: {p.filhos.map(f => typeof f === 'string' ? f : f.nome).join(', ')}</p>
                              {p.filhos.map(f => {
                                const filhoObj = typeof f === 'string' ? null : f;
                                const nomes = filhoObj ? (filhoObj.presentes || []) : [];
                                return filhoObj && nomes.length > 0 ? (
                                  <p key={filhoObj.nome} className="text-sm text-gray-500">Sugestões ({filhoObj.nome}): {nomes.join(', ')}</p>
                                ) : null;
                              })}
                            </div>
                          )}
                            {p.presentes && p.presentes.length > 0 && (
                              <p className="text-sm text-gray-500 mt-1">Sugestões: {p.presentes.join(', ')}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {p.codigoAcesso}
                          </span>
                          {!eventoAtual.sorteado && (
                            <button
                              onClick={() => excluirParticipante(p.id)}
                              className="text-red-500 hover:text-red-700"
                              title="Excluir participante"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {sorteado && (
                        <div className="space-y-1 pt-2 border-t">
                          <div className="flex justify-between items-center">
                            <p className="text-sm">
                              <strong>{p.nome}</strong> tirou: {safeName(eventoAtual.sorteio[p.nome])}
                            </p>
                          </div>
                          {p.filhos && p.filhos.map(filho => {
                            const filhoNome = typeof filho === 'string' ? filho : (filho && filho.nome ? filho.nome : String(filho));
                            return (
                              <div key={filhoNome} className="flex justify-between items-center">
                                  <p className="text-sm">
                                  <strong>{filhoNome}</strong> tirou: {safeName(eventoAtual.sorteio[filhoNome])}
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
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalParticipants)} - {Math.min(currentPage * pageSize, totalParticipants)} de {totalParticipants}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-200 text-gray-400' : 'bg-white border'}`}
                      >
                        Anterior
                      </button>
                      <div className="text-sm text-gray-700">{page} / {totalPages}</div>
                      <button
                        onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-200 text-gray-400' : 'bg-white border'}`}
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {!sorteado && participantes.length >= 2 && (
            <button
              onClick={() => performSecretSantaDraw(eventoAtual, setEventoAtual, eventos, setEventos)}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
              disabled={calculateTotalParticipants(participantes) < 2}
            >
              <Shuffle className="w-5 h-5" />
              Realizar Sorteio
            </button>
          )}

          {eventoAtual.sorteado && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-semibold">✓ Sorteio realizado com sucesso!</p>
                {/* <p className="text-sm text-green-700">Clique nos ícones de envio para compartilhar via WhatsApp</p> */}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={refazerSorteio}
                  className="bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
                >
                  <Shuffle className="w-5 h-5" />
                  Refazer Sorteio
                </button>

                <button
                  onClick={excluirSorteio}
                  className="bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition flex items-center justify-center gap-2"
                >
                  <Trash className="w-5 h-5" />
                  Excluir Sorteio
                </button>
              </div>
            </div>
          )}
          {/* Excluir o evento */}
          <div className="mt-4">
            <button
              onClick={async () => {
                await excluirEvento(eventoAtual.codigo);
                setView('home');
              }}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Excluir Evento
            </button>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
};