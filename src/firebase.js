import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
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

// Enable test mode for Phone Auth in development
// This allows using test phone numbers without real reCAPTCHA verification
const PHONE_AUTH_TEST_MODE = import.meta.env.DEV || import.meta.env.VITE_PHONE_AUTH_TEST_MODE === "true";

try {
  const app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  auth = getAuth(app);

  // Enable test mode for Phone Auth if in development
  // This is required when using test phone numbers configured in Firebase Console
  if (PHONE_AUTH_TEST_MODE && auth) {
    try {
      // @ts-ignore - This property exists but may not be in types
      auth.settings.appVerificationDisabledForTesting = true;
      console.log("Phone Auth: Test mode enabled (appVerificationDisabledForTesting = true)");
    } catch (e) {
      console.warn("Could not enable Phone Auth test mode:", e);
    }
  }

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

// Phone Auth helpers
let recaptchaVerifier = null;
let lastConfirmationResult = null;
let lastPhoneNumber = null;
let recaptchaWidgetId = null;

/**
 * Creates and renders a reCAPTCHA verifier for phone authentication.
 * Following Firebase documentation: https://firebase.google.com/docs/auth/web/phone-auth
 * 
 * @param {string} containerId - The ID of the HTML element to render reCAPTCHA in
 * @param {string} size - Either 'invisible' or 'normal'
 * @returns {Promise<RecaptchaVerifier|null>}
 */
const createRecaptcha = async (containerId = "recaptcha-container", size = "invisible") => {
  if (typeof window === "undefined") {
    console.warn("createRecaptcha: window is undefined (SSR?)");
    return null;
  }
  
  if (!auth) {
    console.warn("createRecaptcha: Firebase Auth not initialized");
    return null;
  }

  // IMPORTANT: Wait for auth to be ready before creating RecaptchaVerifier
  // This ensures the auth object is fully initialized
  await waitForAuth();
  
  // Check if container exists in DOM
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`createRecaptcha: container #${containerId} not found in DOM`);
    return null;
  }

  try {
    // Clear any existing verifier to avoid conflicts
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (e) {
        console.warn("Error clearing previous reCAPTCHA:", e);
      }
      recaptchaVerifier = null;
      recaptchaWidgetId = null;
    }

    // Clear container content to avoid duplicate widgets
    container.innerHTML = "";

    console.log("Creating RecaptchaVerifier with:", { 
      containerId, 
      size, 
      authExists: !!auth,
      authCurrentUser: auth?.currentUser?.uid || "none"
    });

    // Create RecaptchaVerifier following Firebase v9+ modular API
    // Signature: new RecaptchaVerifier(auth, containerOrId, parameters)
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: size,
      callback: (response) => {
        // reCAPTCHA solved - will proceed with signInWithPhoneNumber
        console.log("reCAPTCHA solved successfully");
      },
      "expired-callback": () => {
        // Response expired - ask user to solve reCAPTCHA again
        console.log("reCAPTCHA expired, need to re-verify");
      },
    });

    // Pre-render the reCAPTCHA
    recaptchaWidgetId = await recaptchaVerifier.render();
    console.log("reCAPTCHA rendered successfully, widget ID:", recaptchaWidgetId);
    
    return recaptchaVerifier;
  } catch (error) {
    console.error("createRecaptcha error:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    recaptchaVerifier = null;
    recaptchaWidgetId = null;
    return null;
  }
};

/**
 * Resets the reCAPTCHA widget. Call this after failed verification attempts.
 */
const resetRecaptcha = () => {
  if (recaptchaWidgetId !== null && typeof grecaptcha !== "undefined") {
    try {
      grecaptcha.reset(recaptchaWidgetId);
    } catch (e) {
      console.warn("Error resetting reCAPTCHA:", e);
    }
  }
};

/**
 * Sends a verification code to the specified phone number.
 * 
 * @param {string} phone - Phone number (will be converted to E.164 format)
 * @returns {Promise<boolean>} - True if code was sent successfully
 */
const sendPhoneVerification = async (phone) => {
  if (!auth) throw new Error("Firebase Auth not initialized");
  if (!phone) throw new Error("Phone number is required");

  // Wait for auth to be ready
  await waitForAuth();

  // Normalize phone to digits
  const digits = normalizePhone(phone);
  if (!digits || digits.length < 10) {
    throw new Error("Invalid phone number. Must have at least 10 digits.");
  }

  // Convert to E.164 format
  let phoneE164;
  if (String(phone).startsWith("+")) {
    phoneE164 = phone;
  } else if (digits.length === 10 || digits.length === 11) {
    // Brazilian number: add +55
    phoneE164 = `+55${digits}`;
  } else {
    throw new Error("Phone number must include country code or be a valid Brazilian number (10-11 digits).");
  }

  console.log("Sending verification to:", phoneE164);

  // Create reCAPTCHA verifier if not exists
  if (!recaptchaVerifier) {
    await createRecaptcha();
  }

  if (!recaptchaVerifier) {
    throw new Error("Failed to create reCAPTCHA verifier. Make sure the page has a container with id 'recaptcha-container'.");
  }

  try {
    // Store phone for later use
    lastPhoneNumber = digits;
    
    // Call signInWithPhoneNumber
    lastConfirmationResult = await signInWithPhoneNumber(auth, phoneE164, recaptchaVerifier);
    console.log("Verification code sent successfully");
    return true;
  } catch (error) {
    console.error("sendPhoneVerification error:", error);
    lastPhoneNumber = null;
    lastConfirmationResult = null;
    
    // Reset reCAPTCHA on error as per Firebase documentation
    resetRecaptcha();
    
    throw error;
  }
};

const confirmPhoneCode = async (code) => {
  if (!lastConfirmationResult) throw new Error("No verification in progress");
  try {
    const userCredential = await lastConfirmationResult.confirm(code);
    const uid = userCredential.user?.uid || null;

    // Create a short-lived session mapping: phoneAuthSessions/{uid} -> { phone, createdAt, expiresAt }
    try {
      if (uid && database && lastPhoneNumber) {
        const sessionPath = `phoneAuthSessions/${uid}`;
        const dbRef = ref(database, sessionPath);
        const now = Date.now();
        const expires = now + 1000 * 60 * 60; // 1 hour
        await set(dbRef, { phone: lastPhoneNumber, createdAt: now, expiresAt: expires });
      }
    } catch (err) {
      console.warn("Failed to write phoneAuthSessions mapping:", err);
    }

    // clear temporary state
    lastConfirmationResult = null;
    lastPhoneNumber = null;

    return uid;
  } catch (error) {
    console.error("confirmPhoneCode error:", error);
    throw error;
  }
};

const isPhoneAuthAvailable = () => {
  return !!(typeof RecaptchaVerifier !== "undefined" && auth);
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

  // Phone Auth helpers
  createRecaptcha,
  sendPhoneVerification,
  confirmPhoneCode,
  isPhoneAuthAvailable,
  // Expose auth state change listener
  onAuthStateChanged: (cb) => (auth ? onAuthStateChanged(auth, cb) : null),

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
