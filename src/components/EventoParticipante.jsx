// src/components/EventoParticipante.jsx
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { gerarCodigo, formatarCelular, contarTotalParticipantes, validarCelular } from '../utils/helpers';
import Header from './Header';
import Footer from './Footer';
import CopyButton from './BotaoCopiar';
import Spinner from './Spinner';
import QRCodeCard from './QRCodeCard';

export default function EventoParticipante({
  eventoAtual,
  setEventoAtual,
  eventos,
  setEventos,
  setView,
  nomeParticipante,
  setNomeParticipante,
  celular,
  setCelular,
  filhos,
  setFilhos,
  presentes,
  setPresentes
}) {
  const [novoPresente, setNovoPresente] = useState('');
  const [novoPresenteFilhos, setNovoPresenteFilhos] = useState({});
  // support loading prop if passed
  const [nomeFilho, setNomeFilho] = useState('');
  const [codigoCadastro, setCodigoCadastro] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [codigoParticipante, setCodigoParticipante] = useState('');
  const participantes = eventoAtual?.participantes || [];
  const hasAnyFilhos = participantes.some(p => p.filhos && p.filhos.length > 0);

  const handleCelularChange = (e) => {
    const valorFormatado = formatarCelular(e.target.value);
    setCelular(valorFormatado);
  };

  const adicionarFilho = () => {
    if (nomeFilho.trim()) {
      setFilhos([...filhos, { nome: nomeFilho.trim(), presentes: [] }]);
      setNomeFilho('');
    }
  };

  const removerFilho = (index) => {
    setFilhos(filhos.filter((_, i) => i !== index));
  };

  const adicionarPresente = () => {
    if (novoPresente.trim()) {
      setPresentes([...presentes, novoPresente.trim()]);
      setNovoPresente('');
    }
  };

  const adicionarPresenteFilho = (index) => {
    const val = (novoPresenteFilhos[index] || '').trim();
    if (!val) return;
    const updated = filhos.map((f, i) => {
      if (i !== index) return f;
      if (typeof f === 'string') return { nome: f, presentes: [val] };
      return { ...f, presentes: [...(f.presentes || []), val] };
    });
    setFilhos(updated);
    setNovoPresenteFilhos({ ...novoPresenteFilhos, [index]: '' });
  };

  const removerPresenteFilho = (index, presIndex) => {
    const updated = filhos.map((f, i) => {
      if (i !== index) return f;
      if (typeof f === 'string') return f;
      const newPres = (f.presentes || []).filter((_, pi) => pi !== presIndex);
      return { ...f, presentes: newPres };
    });
    setFilhos(updated);
  };

  const removerPresente = (index) => {
    setPresentes(presentes.filter((_, i) => i !== index));
  };

  const cadastrarParticipante = async () => {
    if (!nomeParticipante.trim() || !celular.trim()) {
      alert('Preencha nome e celular!');
      return;
    }

    // Valida o número de celular
    const validacao = validarCelular(celular);
    if (!validacao.valido) {
      alert(validacao.erro);
      return;
    }

    const participantes = eventoAtual.participantes || [];

    // Verifica se é edição de participante existente
    const participanteExistente = participantes.find(p =>
      p.nome === nomeParticipante.trim() || p.celular === celular.trim()
    );

    let eventoAtualizado;
    let codigoAcessoGerado;

    // normalize filhos to objects before saving
    const filhosNormalizados = (filhos || []).map(f => typeof f === 'string' ? { nome: f, presentes: [] } : { nome: f.nome, presentes: f.presentes || [] });

    if (participanteExistente) {
      // Atualiza participante existente
      codigoAcessoGerado = participanteExistente.codigoAcesso;
      eventoAtualizado = {
        ...eventoAtual,
        participantes: participantes.map(p =>
          p.id === participanteExistente.id
            ? { ...p, nome: nomeParticipante.trim(), celular: celular.trim(), filhos: [...filhosNormalizados], presentes: [...presentes] }
            : p
        )
      };
    } else {
      // Cria novo participante
      codigoAcessoGerado = gerarCodigo();
      const novoParticipante = {
        id: gerarCodigo(),
        nome: nomeParticipante.trim(),
        celular: celular.trim(),
        filhos: [...filhosNormalizados],
        presentes: [...presentes],
        codigoAcesso: codigoAcessoGerado
      };

      eventoAtualizado = {
        ...eventoAtual,
        participantes: [...participantes, novoParticipante]
      };
    }

    try {
      await window.storage.set(`evento:${eventoAtual.codigo}`, JSON.stringify(eventoAtualizado));
      setEventoAtual(eventoAtualizado);
      setEventos({ ...eventos, [eventoAtual.codigo]: eventoAtualizado });

      // Mostra o código na tela
      setCodigoCadastro(codigoAcessoGerado);
      // Mensagem diferente se foi atualização ou novo cadastro
      if (participanteExistente) {
        setSuccessMessage('Cadastro atualizado com sucesso!');
      } else {
        setSuccessMessage('✓ Cadastrado com sucesso!');
      }

      setNomeParticipante('');
      setCelular('');
      setFilhos([]);
      setPresentes([]);
    } catch (error) {
      alert('Erro ao cadastrar. Tente novamente.', error);
    }
  };

  const verResultado = () => {
    const participantes = eventoAtual.participantes || [];
    const participante = participantes.find(
      p => p.codigoAcesso === codigoParticipante.toUpperCase()
    );

    if (!participante) {
      alert('Código inválido!');
      return;
    }

    setEventoAtual({ ...eventoAtual, participanteAtual: participante });
    setView('resultado');
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
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{eventoAtual.nome}</h2>
          {eventoAtual.valorSugerido && (
            <div className="mb-6 pb-6 border-b">
              <p className="text-gray-600">Valor sugerido: <span className="font-bold">R$ {eventoAtual.valorSugerido}</span></p>
            </div>
          )}

          {/* show spinner if evento not ready */}
          {!eventoAtual && (
            <div className="flex items-center justify-center py-12">
              <Spinner size={40} />
            </div>
          )}

          {!eventoAtual.sorteado ? (
            <div className="space-y-4">
              {codigoCadastro && (
                <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 text-center">
                  <p className="text-green-800 font-semibold mb-2">{successMessage}</p>
                  <p className="text-sm text-green-700 mb-3">Guarde este código para ver seu amigo secreto depois do sorteio:</p>
                  <div className="bg-white border border-green-500 rounded-lg p-4 mb-3 flex items-center justify-between">
                    <p className="text-3xl font-bold text-green-600 tracking-wider">{codigoCadastro}</p>
                    <CopyButton text={codigoCadastro} />
                  </div>
                </div>
              )}

              {!codigoCadastro && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seu Nome
                    </label>
                    <input
                      type="text"
                      placeholder="Digite seu nome"
                      value={nomeParticipante}
                      onChange={(e) => setNomeParticipante(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WhatsApp (com DDD)
                    </label>
                    <input
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={celular}
                      onChange={handleCelularChange}
                      maxLength={15}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="mb-6 pb-6 border-b">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minhas sugestões de presentes
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Ex: Livro, camiseta, caneca..."
                        value={novoPresente}
                        onChange={(e) => setNovoPresente(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && adicionarPresente()}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={adicionarPresente}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    {presentes.length > 0 && (
                      <div className="space-y-2">
                        {presentes.map((pres, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                            <span className="text-sm">{pres}</span>
                            <button
                              onClick={() => removerPresente(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filhos (sem celular)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Nome do filho"
                        value={nomeFilho}
                        onChange={(e) => setNomeFilho(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && adicionarFilho()}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={adicionarFilho}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    {filhos.length > 0 && (
                      <div className="space-y-2">
                        {filhos.map((filho, index) => {
                          const nome = typeof filho === 'string' ? filho : filho.nome;
                          const presentesFilho = typeof filho === 'string' ? [] : (filho.presentes || []);
                          return (
                            <div key={index} className="bg-gray-50 p-3 rounded">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{nome}</span>
                                <button
                                  onClick={() => removerFilho(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="mt-2">
                                <div className="flex gap-2 mb-2">
                                  <input
                                    type="text"
                                    placeholder="Sugestão para este filho"
                                    value={novoPresenteFilhos[index] || ''}
                                    onChange={(e) => setNovoPresenteFilhos({ ...novoPresenteFilhos, [index]: e.target.value })}
                                    onKeyPress={(e) => e.key === 'Enter' && adicionarPresenteFilho(index)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                  />
                                  <button
                                    onClick={() => adicionarPresenteFilho(index)}
                                    className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>

                                {presentesFilho.length > 0 && (
                                  <div className="space-y-1">
                                    {presentesFilho.map((pres, pi) => (
                                      <div key={pi} className="flex items-center justify-between bg-white px-3 py-1 rounded">
                                        <span className="text-sm text-gray-700">{pres}</span>
                                        <button onClick={() => removerPresenteFilho(index, pi)} className="text-red-500 hover:text-red-700">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={cadastrarParticipante}
                    className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
                  >
                    {eventoAtual.participantes?.some(p => p.nome === nomeParticipante.trim() || p.celular === celular.trim())
                      ? 'Atualizar Cadastro'
                      : 'Cadastrar'}
                  </button>


                  {/* Show QR if this view was opened as event (no participant prefilled) and not yet sorteado */}
                  {eventoAtual && !eventoAtual.sorteado && nomeParticipante === '' && (
                    <div className="py-4">
                      <QRCodeCard url={`${window.location.origin}?code=${eventoAtual.codigo}`} label="Compartilhe este evento" size={200} eventName={eventoAtual.nome} />
                    </div>
                  )}

                  <div>
                    <p className="font-semibold text-gray-800 text-sm text-gray-600 mb-2">
                      Participantes: {contarTotalParticipantes(participantes)}{hasAnyFilhos ? ', incluindo filhos' : ''}
                    </p>
                    <div className="space-y-1">
                      {participantes
                        .slice()
                        .sort((a, b) => a.nome.localeCompare(b.nome, undefined, { sensitivity: 'base' }))
                        .map(p => (
                          <div key={p.id} className="text-sm text-gray-700">
                            {p.nome} {p.filhos && p.filhos.length > 0 && `(+ ${p.filhos.map(f => typeof f === 'string' ? f : f.nome).join(', ')})`}
                            {p.presentes && p.presentes.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">Sugestões: {p.presentes.join(', ')}</div>
                            )}
                            {p.filhos && p.filhos.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                {p.filhos.map((f, i) => {
                                  const filhoObj = typeof f === 'string' ? null : f;
                                  const nomeFilho = filhoObj ? filhoObj.nome : f;
                                  const presentesFilho = filhoObj ? (filhoObj.presentes || []) : [];
                                  return presentesFilho.length > 0 ? (
                                    <div key={i}>Sugestões ({nomeFilho}): {presentesFilho.join(', ')}</div>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-semibold">Sorteio já realizado!</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Digite seu código de acesso
                </label>
                <input
                  type="text"
                  placeholder="Código recebido no cadastro"
                  value={codigoParticipante}
                  onChange={(e) => setCodigoParticipante(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
                />
                <button
                  onClick={verResultado}
                  className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition"
                >
                  Ver Meu Amigo Secreto
                </button>
              </div>
            </div>
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}