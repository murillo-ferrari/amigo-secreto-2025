import React from 'react';
import CopyButton from './BotaoCopiar';

export default function ErrorScreen({ error, onRetry }) {
  const message = (error && error.message) ? error.message : String(error);

  const suggestions = [];
  if (/ERR_NAME_NOT_RESOLVED/i.test(message) || /ENOTFOUND/i.test(message)) {
    suggestions.push('Verifique sua conexão com a internet.');
    suggestions.push('Confirme se o valor `VITE_FIREBASE_DATABASE_URL` está correto em `.env.local`.');
  } else if (/Can't determine Firebase Database URL|FIREBASE FATAL ERROR/i.test(message)) {
    suggestions.push('Adicione `VITE_FIREBASE_PROJECT_ID` e `VITE_FIREBASE_DATABASE_URL` no arquivo `.env.local`.');
    suggestions.push('Reinicie o servidor de desenvolvimento após editar `.env.local`.');
  } else {
    suggestions.push('Verifique a configuração do Firebase e as variáveis de ambiente.');
    suggestions.push('Confira o console do navegador para mais detalhes do erro.');
  }

  const copyError = async () => {
    try {
      await navigator.clipboard.writeText(message);
      // small feedback could be added here if desired
    } catch (e) {
      console.error('Não foi possível copiar o erro:', e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-lg w-full bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Problema ao acessar os dados</h2>
        <p className="text-sm text-gray-700 mb-4">Não foi possível acessar o banco de dados do sistema.</p>

        <div className="bg-red-50 border border-red-100 p-3 rounded mb-4">
          <strong className="text-red-700">Detalhes:</strong>
          <pre className="whitespace-pre-wrap text-xs text-red-700 mt-1">{message}</pre>
        </div>

        <div className="mb-4">
          <strong className="block text-sm mb-1">Sugestões</strong>
          <ul className="list-disc list-inside text-sm text-gray-700">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => { if (onRetry) onRetry(); }}
          >
            Tentar novamente
          </button>
          <CopyButton text={message} onClick={copyError} label="Copiar erro" copiedLabel="Erro copiado!" />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </button>
        </div>
      </div>
    </div>
  );
}
