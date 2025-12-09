import { createContext, useContext } from "react";
import firebaseStorage from "../firebase";

// Create context with the firebase storage object
const FirebaseContext = createContext(null);

/**
 * Hook to access Firebase storage functions.
 */
export function useFirebase() {
    const context = useContext(FirebaseContext);
    if (!context) {
        throw new Error("useFirebase must be used within a FirebaseProvider");
    }
    return context;
}

/**
 * Provider component that makes firebase storage available to the app.
 */
export function FirebaseProvider({ children }) {
    return (
        <FirebaseContext.Provider value={firebaseStorage}>
            {children}
        </FirebaseContext.Provider>
    );
}

// Also export the storage directly for use in non-React contexts (services, utils)
export { firebaseStorage };

