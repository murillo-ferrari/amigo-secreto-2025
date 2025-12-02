// src/App.jsx
import React, { useState, useEffect } from 'react';
import Home from './components/Home';
import CriarEvento from './components/CriarEvento';
import EventoParticipante from './components/EventoParticipante';
import AdminEvento from './components/AdminEvento';
import Resultado from './components/Resultado';
import { verificarHash } from './utils/helpers';
import ErrorScreen from './components/ErrorScreen';

export default function AmigoSecreto() {
  const [view, setView] = useState('home');
  const [eventos, setEventos] = useState({});
  const [eventoAtual, setEventoAtual] = useState(null);
  const [loading, setLoading] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [codigoAcesso, setCodigoAcesso] = useState('');
  
  // Estados para participante
  const [nomeParticipante, setNomeParticipante] = useState('');
  const [celular, setCelular] = useState('');
  const [filhos, setFilhos] = useState([]);
  const [presentes, setPresentes] = useState([]);
  
  useEffect(() => {
    // On mount, load events and, if a ?code=... query param is present,
    // try to open that event automatically (useful for QR links).
    const init = async () => {
      // If storage initialization failed, show the error screen
      try {
        if (window.storage && window.storage.initError) {
          setStorageError(window.storage.initError);
          return;
        }
      } catch (err) {
        console.error('Erro ao verificar storage/init:', err);
      }

      await carregarEventos();
      try {
        const params = new URLSearchParams(window.location.search);
        const codeParam = params.get('code');
        if (codeParam) {
          // Try to access event using the code from URL
          await acessarEvento(codeParam);
        }
      } catch (err) {
        console.error('Erro ao processar query params:', err);
      }
    };

    init();
  }, []);
  
  const carregarEventos = async () => {
    setLoading(true);
    try {
      const keys = await window.storage.list('evento:');
      const eventosCarregados = {};
      
      for (const key of keys.keys) {
        const result = await window.storage.get(key);
        if (result) {
          eventosCarregados[key.replace('evento:', '')] = JSON.parse(result.value);
        }
      }
      
      setEventos(eventosCarregados);
    } catch (error) {
      console.log('Nenhum evento encontrado ainda', error);
      setStorageError(error);
    } finally {
      setLoading(false);
    }
  };
  
  const acessarEvento = async (codeArg) => {
    setLoading(true);
    const codigo = (codeArg || codigoAcesso || '').toUpperCase();
    
    try {
      // Primeiro tenta acessar diretamente como código do evento
      let result = await window.storage.get(`evento:${codigo}`);
      let eventoEncontrado = null;
      let participanteEncontrado = null;
      let isAdmin = false;
      
      // Se não encontrou, procura em todos os eventos
      if (!result) {
        const keys = await window.storage.list('evento:');
        for (const key of keys.keys) {
          const eventoResult = await window.storage.get(key);
          if (eventoResult) {
            const evento = JSON.parse(eventoResult.value);
            const participantes = evento.participantes || [];
            
            // Verifica se é código admin (usando hash)
            if (evento.codigoAdminHash) {
              const isAdminCode = await verificarHash(codigo, evento.codigoAdminHash);
              if (isAdminCode) {
                eventoEncontrado = evento;
                isAdmin = true;
                break;
              }
            }
            // Fallback para código admin em texto (eventos antigos)
            else if (evento.codigoAdmin === codigo) {
              eventoEncontrado = evento;
              isAdmin = true;
              break;
            }
            
            // Verifica se é código de participante
            const participante = participantes.find(p => p.codigoAcesso === codigo);
            if (participante) {
              eventoEncontrado = evento;
              participanteEncontrado = participante;
              break;
            }
          }
        }
      } else {
        eventoEncontrado = JSON.parse(result.value);
      }
      
      if (eventoEncontrado) {
        // Verifica se é código admin
        if (isAdmin) {
          setEventoAtual({...eventoEncontrado, codigoAdmin: codigo}); // Mantém código para a sessão
          setView('admin');
        } 
        // Verifica se é código de participante
        else if (participanteEncontrado) {
          // Se já foi sorteado, vai direto para resultado
          if (eventoEncontrado.sorteado) {
            setEventoAtual({...eventoEncontrado, participanteAtual: participanteEncontrado});
            setView('resultado');
          } else {
            // Se não foi sorteado, permite editar dados
            setEventoAtual(eventoEncontrado);
            setNomeParticipante(participanteEncontrado.nome);
            setCelular(participanteEncontrado.celular);
            setFilhos(participanteEncontrado.filhos || []);
            setPresentes(participanteEncontrado.presentes || []);
            setView('evento');
          }
        }
        // Código do evento (novo participante)
        else {
          setEventoAtual(eventoEncontrado);
          setNomeParticipante('');
          setCelular('');
          setFilhos([]);
          setPresentes([]);
          setView('evento');
        }
        setCodigoAcesso('');
      } else {
        alert('Código não encontrado!');
      }
    } catch (error) {
      console.error('Erro ao acessar evento:', error);
      setStorageError(error);
    } finally {
      setLoading(false);
    }
  };

  // Recupera evento/participante a partir do celular (esqueci meu código)
  const recuperarPorCelular = async (celularInput) => {
    setLoading(true);
    try {
      const digits = (celularInput || '').replace(/\D/g, '');
      if (!digits) {
        alert('Informe o celular (com DDD)');
        return;
      }

      const keys = await window.storage.list('evento:');
      for (const key of keys.keys) {
        const eventoResult = await window.storage.get(key);
        if (!eventoResult) continue;
        const evento = JSON.parse(eventoResult.value);
        const participantes = evento.participantes || [];
        const participante = participantes.find(p => {
          const pDigits = (p.celular || '').replace(/\D/g, '');
          return pDigits === digits || pDigits.endsWith(digits) || digits.endsWith(pDigits);
        });

        if (participante) {
          // If the event already has a resultado/sorteio, go to resultado view
          if (evento.sorteado) {
            setEventoAtual({ ...evento, participanteAtual: participante });
            setView('resultado');
            setCodigoAcesso('');
            return;
          }
          // Otherwise, prefill participant fields and go to event form
          setEventoAtual(evento);
          setNomeParticipante(participante.nome || '');
          setCelular(participante.celular || '');
          setFilhos(participante.filhos || []);
          setPresentes(participante.presentes || []);
          setView('evento');
          setCodigoAcesso('');
          return;
        }
      }
      alert('Celular não encontrado. Verifique o número e tente novamente.');
    } catch (error) {
      console.error('Erro ao recuperar por celular:', error);
      setStorageError(error);
    } finally {
      setLoading(false);
    }
  };
  
  // Renderiza componente baseado na view
  if (storageError) {
    return <ErrorScreen error={storageError} onRetry={() => { setStorageError(null); window.location.reload(); }} />;
  }
  if (view === 'home') {
    return (
      <Home 
        setView={setView}
        codigoAcesso={codigoAcesso}
        setCodigoAcesso={setCodigoAcesso}
        acessarEvento={acessarEvento}
        recuperarPorCelular={recuperarPorCelular}
        loading={loading}
      />
    );
  }
  
  if (view === 'criar') {
    return (
      <CriarEvento 
        setView={setView}
        eventos={eventos}
        setEventos={setEventos}
        setEventoAtual={setEventoAtual}
      />
    );
  }
  
  if (view === 'evento') {
    return (
      <EventoParticipante 
        eventoAtual={eventoAtual}
        setEventoAtual={setEventoAtual}
        eventos={eventos}
        setEventos={setEventos}
        setView={setView}
        nomeParticipante={nomeParticipante}
        setNomeParticipante={setNomeParticipante}
        celular={celular}
        setCelular={setCelular}
        filhos={filhos}
        setFilhos={setFilhos}
        presentes={presentes}
        setPresentes={setPresentes}
        loading={loading}
      />
    );
  }
  
  if (view === 'admin') {
    return (
      <AdminEvento 
        eventoAtual={eventoAtual}
        setEventoAtual={setEventoAtual}
        eventos={eventos}
        setEventos={setEventos}
        setView={setView}
        loading={loading}
      />
    );
  }
  
  if (view === 'resultado') {
    return (
      <Resultado 
        eventoAtual={eventoAtual}
        setView={setView}
        setEventoAtual={setEventoAtual}
        setCodigoAcesso={setCodigoAcesso}
      />
    );
  }
  
  return null;
}