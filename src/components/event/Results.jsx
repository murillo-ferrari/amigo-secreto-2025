import { Gift, Send } from 'lucide-react';
// import { gerarLinkWhatsApp } from '../utils/helpers';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import CopyButton from '../common/CopyButton';


export default function Resultado({ eventoAtual, setView, setEventoAtual, setCodigoAcesso }) {
  const participante = eventoAtual.participanteAtual;
  const codigoCadastro = participante?.codigoAcesso || '';
  const successMessage = eventoAtual.successMessage || (participante ? 'Seu código de acesso' : null);
  // Encontrar o participante correspondente ao amigo sorteado para exibir sugestões
  const findPersonByName = (name) => {
    const participantes = eventoAtual.participantes || [];
    for (const p of participantes) {
      if (p.nome === name) return p;
      if (p.filhos) {
        for (const f of p.filhos) {
          if (typeof f === 'string') {
            if (f === name) return { nome: f, presentes: [] };
          } else {
            if (f.nome === name) return f;
          }
        }
      }
    }
    return null;
  };

  const safeName = (val) => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val.nome) return val.nome;
    return String(val);
  };

  const amigoNome = participante ? safeName(eventoAtual.sorteio[participante.nome]) : null;
  const amigoObj = amigoNome ? findPersonByName(amigoNome) : null;
  const amigoPresentes = amigoObj?.presentes || [];

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
              <p className="text-3xl font-bold text-red-600">{safeName(eventoAtual.sorteio[participante.nome])}</p>
              {amigoPresentes.length > 0 && (
                <div className="mt-3 text-left">
                  <p className="text-sm text-gray-700 mb-1">Sugestões do seu amigo:</p>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {amigoPresentes.map((pres, i) => <li key={i}>{pres}</li>)}
                  </ul>
                </div>
              )}
              {/* Optional: share to WhatsApp button can be re-enabled here */}
            </div>

            {participante.filhos && participante.filhos.map(filho => {
              const filhoNome = typeof filho === 'string' ? filho : (filho && filho.nome ? filho.nome : String(filho));
              const amigoDoFilhoNome = safeName(eventoAtual.sorteio[filhoNome]);
              const amigoDoFilhoObj = amigoDoFilhoNome ? findPersonByName(amigoDoFilhoNome) : null;
              const amigoDoFilhoPresentes = amigoDoFilhoObj?.presentes || [];

              return (
                <div key={filhoNome} className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Amigo secreto de <b>{filhoNome}</b>:</p>
                  <p className="text-2xl font-bold text-blue-600">{amigoDoFilhoNome}</p>
                  {amigoDoFilhoPresentes.length > 0 && (
                    <div className="mt-3 text-left">
                      <p className="text-sm text-gray-700 mb-1">Sugestões do amigo:</p>
                      <ul className="list-disc list-inside text-sm text-gray-700">
                        {amigoDoFilhoPresentes.map((pres, i) => <li key={i}>{pres}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}

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