import Footer from "../layout/Footer";
import Header from "../layout/Header";
import RecoverCode from "./EventRecoverCode";

export default function Home({
  setView,
  codigoAcesso: eventAccessCode,
  setCodigoAcesso: updateEventAccessCode,
  acessarEvento: accessEvent,
  recuperarPorCelular: retrieveCodeByPhone,
  recuperarEventoPorCelular,
  loading,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-12">
        <Header />

        <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
          <button
            onClick={() => setView("criar")}
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
              placeholder="Digite o ID do evento / seu código de acesso"
              value={eventAccessCode}
              onChange={(e) => updateEventAccessCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-3"
            />
            <button
              onClick={() => accessEvent()}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              {loading ? "Carregando..." : "Acessar Evento"}
            </button>

            <RecoverCode
              recuperarPorCelular={retrieveCodeByPhone}
              recuperarEventoPorCelular={recuperarEventoPorCelular}
              loading={loading}
            />
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}