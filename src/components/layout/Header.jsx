import { Gift, CheckCircle } from "lucide-react";

export default function Header({ verified = null }) {
  let isVerified = false;
  if (typeof verified === "boolean") isVerified = verified;
  else {
    try {
      if (window.storage && window.storage.getCurrentUserUid) {
        isVerified = !!window.storage.getCurrentUserUid();
      }
    } catch (err) {
      isVerified = false;
    }
  }

  return (
    <header className="text-center mb-8">
      <Gift className="w-16 h-16 mx-auto text-red-500 mb-4" />
      <div className="flex items-center justify-center gap-2">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Amigo Secreto</h1>
        {isVerified && (
          <span className="text-green-600 flex items-center gap-1 text-sm">
            <CheckCircle className="w-4 h-4" /> Verified
          </span>
        )}
      </div>
      <p className="text-gray-600">Organize seu amigo secreto de forma simples</p>
    </header>
  );
}
