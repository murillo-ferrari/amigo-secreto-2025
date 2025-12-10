import { CheckCircle, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import firebaseStorage from "../../firebase";

export default function Header({ verified = null, phone = null }) {
  const [isVerified, setIsVerified] = useState(typeof verified === "boolean" ? verified : false);

  useEffect(() => {
    // If already verified via prop, no need to check session
    if (typeof verified === "boolean" && verified) {
      setIsVerified(true);
      return;
    }

    // Check session if phone is provided
    if (phone && firebaseStorage.isPhoneVerifiedInSession) {
      firebaseStorage.isPhoneVerifiedInSession(phone).then((result) => {
        // console.log("Header: isVerified from session?", result);
        if (result) setIsVerified(true);
      });
    }
  }, [verified, phone]);

  return (
    <header className="flex flex-col gap-2 text-center">
      <Gift className="w-16 h-16 mx-auto text-red-500" />
      <div className="flex flex-col items-center justify-center gap-2">
        <h1 className="text-4xl font-bold text-gray-800">Amigo Secreto</h1>
        {/* {isVerified && (
          <span className="text-green-600 flex items-center gap-1 text-sm">
            <CheckCircle className="w-4 h-4" /> Verificado
          </span>
        )} */}
      </div>
      <p className="text-gray-600">Organize seu amigo secreto de forma simples</p>
    </header>
  );
}
