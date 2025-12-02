import { Gift, Send } from 'lucide-react';
// import { gerarLinkWhatsApp } from '../utils/helpers';
import Header from './Header';
import Footer from './Footer';
import CopyButton from './BotaoCopiar';


export default function Resultado({ eventoAtual, setView, setEventoAtual, setCodigoAcesso }) {
  const participante = eventoAtual.participanteAtual;
  const codigoCadastro = participante?.codigoAcesso || '';
  const successMessage = eventoAtual.successMessage || (participante ? 'Seu código de acesso' : null);

/*   const enviarWhatsApp = (nome, amigo, celular) => {
    const url = gerarLinkWhatsApp(nome, amigo, celular, eventoAtual.nome, eventoAtual.valorSugerido);
    window.open(url, '_blank');
  }; */

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-12">
      <Header />
        <button
          onClick={() => {
            setView('home');
            setEventoAtual(null);
            setCodigoAcesso('');
          }}
          className="mb-4 text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{eventoAtual.nome}</h2>
          {eventoAtual.valorSugerido && (
            <div className="mb-6 pb-6 border-b">
              <p className="text-gray-600">Valor sugerido: <span className="font-bold">R$ {eventoAtual.valorSugerido}</span></p>
            </div>
          )}

          <div className="space-y-4">

            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Seu amigo secreto é:</p>
              <p className="text-3xl font-bold text-red-600">{eventoAtual.sorteio[participante.nome]}</p>
              {/* <button
                onClick={() => enviarWhatsApp(participante.nome, eventoAtual.sorteio[participante.nome], participante.celular)}
                className="mt-4 bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition flex items-center gap-2 mx-auto"
              >
                <Send className="w-4 h-4" />
                Enviar para WhatsApp
              </button> */}
            </div>

            {participante.filhos && participante.filhos.map(filho => (
              <div key={filho} className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Amigo secreto de <b>{filho}</b>:</p>
                <p className="text-2xl font-bold text-blue-600">{eventoAtual.sorteio[filho]}</p>
                {/* <button
                  onClick={() => enviarWhatsApp(filho, eventoAtual.sorteio[filho], participante.celular)}
                  className="mt-4 bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition flex items-center gap-2 mx-auto"
                >
                  <Send className="w-4 h-4" />
                  Enviar para WhatsApp
                </button> */}
              </div>
            ))}
          </div>

          {codigoCadastro && (
            <div className="mt-6 pt-6 border-t">
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 text-center">
                <p className="text-green-800 font-semibold mb-2">{successMessage}</p>
                <p className="text-sm text-green-700 mb-3">Guarde este código para ver seu amigo secreto depois do sorteio:</p>
                <div className="bg-white border border-green-500 rounded-lg p-4 mb-3 flex items-center justify-between">
                  <p className="text-3xl font-bold text-green-600 tracking-wider">{codigoCadastro}</p>
                  <CopyButton text={codigoCadastro} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}