import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { get, getDatabase, ref, remove, set } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase services and variables
let database = null;
let auth = null;
let initError = null;
let authReady = false;
let authReadyPromise = null;

try {
  const app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  auth = getAuth(app);

  // Creates a promise that resolves when authentication is ready
  authReadyPromise = new Promise((resolve, reject) => {
    // Attempts anonymous authentication
    signInAnonymously(auth)
      .then(() => {
        // console.log("Firebase: Autenticado anonimamente");
        authReady = true;
        resolve(true);
      })
      .catch((error) => {
        console.error("Firebase: Erro na autenticação anônima:", error);

        // Clear message if anonymous auth is disabled
        if (error.code === "auth/configuration-not-found") {
          const helpError = new Error(
            "Autenticação anônima não está habilitada no Firebase."
          );
          helpError.originalError = error;
          initError = helpError;
          reject(helpError);
        } else {
          initError = error;
          reject(error);
        }
      });

    // Also listen for auth state changes
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // console.log("Firebase: Usuário autenticado:", user.uid);
        authReady = true;
        resolve(true);
      }
    });
  });
} catch (err) {
  console.error("Firebase initialization error:", err);
  initError = err;
  authReadyPromise = Promise.reject(err);
}

// Convert storage key to Firebase path
// Uses hierarchical structure: "eventos/CODIGO" instead of "evento:CODIGO"
const toFirebasePath = (key) => {
  // Converts "evento:CODIGO" to "eventos/CODIGO"
  if (key.startsWith("evento:")) {
    return "eventos/" + key.substring(7);
  }
  return key.replace(/:/g, "/");
};

// Convert Firebase path back to storage key
const fromFirebasePath = (path) => {
  // Converts "eventos/CODIGO" to "evento:CODIGO"
  if (path.startsWith("eventos/")) {
    return "evento:" + path.substring(8);
  }
  return path.replace(/\//g, ":");
};

// Helper to wait for authentication before operations
const waitForAuth = async () => {
  if (authReady) return true;
  if (authReadyPromise) {
    try {
      await authReadyPromise;
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

// Phone index functions for looking up events by phone number
const normalizePhone = (phone) => {
  // Remove all non-digit characters and return clean phone number
  return (phone || "").replace(/\D/g, "");
};

const setPhoneIndex = async (phone, eventCode) => {
  if (!database) return;
  await waitForAuth();

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || !eventCode) return;

  try {
    // Debug: log auth state and path to help diagnose permission errors
    try {
      console.debug(
        "setPhoneIndex: auth:",
        auth?.currentUser ? { uid: auth.currentUser.uid } : null,
        {
          normalizedPhone,
          eventCode,
        }
      );
    } catch (error) {
      console.warn("Error logging setPhoneIndex debug info:", error);
    }

    // Store under phones/{phone}/{eventCode} so a single phone can map to multiple events
    const phonePath = `phones/${normalizedPhone}/${eventCode}`;
    const dbRef = ref(database, phonePath);
    await set(dbRef, { updatedAt: Date.now() });
    // console.log(`Phone index entry created: ${normalizedPhone} -> ${eventCode}`);
  } catch (error) {
    console.warn("Error creating phone index:", error);
    // Non-critical error - don't throw
  }
};

const removePhoneIndex = async (phone, eventCode = null) => {
  if (!database) return;
  await waitForAuth();

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return;

  try {
    const phonePath = eventCode
      ? `phones/${normalizedPhone}/${eventCode}`
      : `phones/${normalizedPhone}`;
    const dbRef = ref(database, phonePath);
    await remove(dbRef);
    // console.log(`Phone index removed: ${normalizedPhone}${eventCode ? ' -> ' + eventCode : ''}`);
  } catch (error) {
    console.warn("Error removing phone index:", error);
    // Non-critical error - don't throw
  }
};

const getEventCodeByPhone = async (phone) => {
  // Backwards-compatible single-event lookup. Prefer getEventCodesByPhone where possible.
  if (!database) return null;
  await waitForAuth();

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  try {
    const phonePath = `phones/${normalizedPhone}`;
    const dbRef = ref(database, phonePath);
    const snapshot = await get(dbRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      // Old format: { eventCode, updatedAt }
      if (data && typeof data === "object" && data.eventCode) {
        return data.eventCode || null;
      }
      // New format: { EVENTCODE1: { updatedAt }, EVENTCODE2: { updatedAt }, ... }
      if (data && typeof data === "object") {
        const keys = Object.keys(data);
        return keys.length > 0 ? keys[0] : null;
      }
    }
    return null;
  } catch (error) {
    console.warn("Error looking up phone index:", error);
    return null;
  }
};

const getEventCodesByPhone = async (phone) => {
  // Return all event codes associated with a phone (new multi-mapping format).
  if (!database) return [];
  await waitForAuth();

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return [];

  try {
    const phonePath = `phones/${normalizedPhone}`;
    const dbRef = ref(database, phonePath);
    const snapshot = await get(dbRef);

    if (!snapshot.exists()) return [];
    const data = snapshot.val();

    // Old single mapping
    if (data && typeof data === "object" && data.eventCode) {
      return [data.eventCode];
    }

    // New mapping: keys are event codes
    if (data && typeof data === "object") {
      return Object.keys(data);
    }

    return [];
  } catch (error) {
    console.warn("Error looking up phone index:", error);
    return [];
  }
};

// Adapts the API to be compatible with window.storage
const firebaseStorage = {
  // Exposes the auth promise for those who need to wait
  waitForAuth,

  // Phone index functions
  setPhoneIndex,
  removePhoneIndex,
  getEventCodeByPhone,
  getEventCodesByPhone,

  // Return current authenticated user's UID (or null)
  getCurrentUserUid: () =>
    auth && auth.currentUser ? auth.currentUser.uid : null,

  async get(key) {
    if (initError || !database) {
      const e =
        initError ||
        new Error(
          "Firebase não inicializado corretamente. Verifique as variáveis de ambiente."
        );
      console.error("Erro ao ler do Firebase (init):", e);
      throw e;
    }

    // Waits for authentication before reading
    await waitForAuth();

    try {
      const firebasePath = toFirebasePath(key);
      const dbRef = ref(database, firebasePath);
      const snapshot = await get(dbRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        return {
          key: key,
          value: typeof data === "object" ? JSON.stringify(data) : data,
          shared: false,
        };
      }
      return null;
    } catch (error) {
      console.error("Erro ao ler do Firebase:", error);
      throw error;
    }
  },

  async set(key, value) {
    if (initError || !database) {
      const e =
        initError ||
        new Error(
          "Firebase não inicializado corretamente. Verifique as variáveis de ambiente."
        );
      console.error("Erro ao salvar no Firebase (init):", e);
      throw e;
    }

    // Waits for authentication before saving
    await waitForAuth();

    try {
      const firebasePath = toFirebasePath(key);
      const dbRef = ref(database, firebasePath);
      const dataToSave = typeof value === "string" ? JSON.parse(value) : value;
      try {
        console.debug(
          "firebase.set: auth:",
          auth?.currentUser ? { uid: auth.currentUser.uid } : null,
          {
            path: firebasePath,
            dataType: Array.isArray(dataToSave) ? "array" : typeof dataToSave,
            dataKeys:
              dataToSave && typeof dataToSave === "object"
                ? Object.keys(dataToSave).slice(0, 5)
                : null,
          }
        );
      } catch (error) {
        console.warn("Error logging setPhoneIndex debug info:", error);
      }
      await set(dbRef, dataToSave);
      return {
        key: key,
        value: value,
        shared: false,
      };
    } catch (error) {
      console.error("Erro ao salvar no Firebase:", error);
      throw error;
    }
  },

  async delete(key) {
    if (initError || !database) {
      const e =
        initError ||
        new Error(
          "Firebase não inicializado corretamente. Verifique as variáveis de ambiente."
        );
      console.error("Erro ao deletar no Firebase (init):", e);
      throw e;
    }

    // Waits for authentication before deleting
    await waitForAuth();

    try {
      const firebasePath = toFirebasePath(key);
      const dbRef = ref(database, firebasePath);
      try {
        console.debug(
          "firebase.remove: auth:",
          auth?.currentUser ? { uid: auth.currentUser.uid } : null,
          { path: firebasePath }
        );
      } catch (error) {
        console.warn("Error logging remove debug info:", error);
      }
      await remove(dbRef);
      return {
        key: key,
        deleted: true,
        shared: false,
      };
    } catch (error) {
      console.error("Erro ao deletar do Firebase:", error);
      throw error;
    }
  },

  async list(prefix = "") {
    if (initError || !database) {
      const e =
        initError ||
        new Error(
          "Firebase não inicializado corretamente. Verifique as variáveis de ambiente."
        );
      console.error("Erro ao listar no Firebase (init):", e);
      throw e;
    }

    // Waits for authentication before listing
    await waitForAuth();

    try {
      // With the new security rules, we cannot list the root.
      let basePath = "";
      if (prefix.startsWith("evento:")) {
        basePath = "eventos";
      }

      const dbRef = ref(database, basePath || undefined);
      const snapshot = await get(dbRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        // If we are listing events, the keys are the codes directly
        if (basePath === "eventos") {
          const keys = Object.keys(data).map((code) => `evento:${code}`);
          return {
            keys: keys,
            prefix: prefix,
            shared: false,
          };
        }
        // Fallback for other prefixes
        const keys = Object.keys(data).map((key) => fromFirebasePath(key));
        return {
          keys: keys,
          prefix: prefix,
          shared: false,
        };
      }

      return {
        keys: [],
        prefix: prefix,
        shared: false,
      };
    } catch (error) {
      console.warn("Erro ao listar do Firebase:", error);
      throw error;
    }
  },
};

// Adds to window for compatibility
if (typeof window !== "undefined") {
  firebaseStorage.initError = initError;
  firebaseStorage.isAvailable = !!database;
  window.storage = firebaseStorage;
}

export default firebaseStorage;
