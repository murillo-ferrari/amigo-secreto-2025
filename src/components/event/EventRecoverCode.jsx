import { useState } from "react";
import { formatMobileNumber, verifyMobileNumber } from "../../utils/helpers";

export default function RecoverCode({ recuperarPorCelular: recoverCodeByPhone, loading }) {
  const [showRecover, setShowRecover] = useState(false);
  const [recoveryPhoneNumber, setRecoverCelular] = useState("");

  return (
    <div>
      <div className="mt-3 text-center">
        <button
          onClick={() => setShowRecover(!showRecover)}
          className="text-sm text-gray-600 underline"
        >
          Esqueci meu código
        </button>
      </div>

      {showRecover && (
        <div className="mt-3 bg-gray-50 p-3 rounded">
          <p className="text-sm text-gray-700 mb-2">
            Informe o seu WhatsApp (com DDD) para recuperar o código
          </p>
          <input
            type="tel"
            placeholder="(11) 99999-9999"
            value={recoveryPhoneNumber}
            onChange={(e) =>
              setRecoverCelular(formatMobileNumber(e.target.value))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                const valid = verifyMobileNumber(recoveryPhoneNumber);
                if (!valid.isValid) {
                  alert(valid.errorMessage);
                  return;
                }
                recoverCodeByPhone(recoveryPhoneNumber);
              }}
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Procurando..." : "Procurar"}
            </button>
            <button
              onClick={() => {
                setShowRecover(false);
                setRecoverCelular("");
              }}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
