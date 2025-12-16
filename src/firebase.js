import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInAnonymously,
  PhoneAuthProvider,
  linkWithCredential,
} from "firebase/auth";
import { get, getDatabase, ref, remove, set } from "firebase/database";
import { deobfuscatePhone, hashPhone, isObfuscated, maskPhone, obfuscatePhone } from "./utils/crypto.js";

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
const PHONE_AUTH_TEST_MODE =
  import.meta.env.DEV || import.meta.env.VITE_PHONE_AUTH_TEST_MODE === "true";

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
      /* console.log(
        "Phone Auth: Test mode enabled (appVerificationDisabledForTesting = true)"
      ); */
    } catch (error) {
      console.warn("Could not enable Phone Auth test mode:", error);
    }
  }

  // Creates a promise that resolves when auth is initialized
  // No anonymous auth - we use phone auth for verified users,
  // and database rules allow public reads for events
  authReadyPromise = new Promise((resolve) => {
    // Listen for auth state changes (will fire when phone auth succeeds)
    const _unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        authReady = true;
        resolve(true);
      }
    });

    // Also resolve immediately for unauthenticated reads
    // (database rules must allow public reads for eventos)
    setTimeout(() => {
      if (!authReady) {
        authReady = true;
        resolve(true);
      }
    }, 100);
  });
} catch (firebaseError) {
  console.error("Firebase initialization error:", firebaseError);
  initError = firebaseError;
  authReadyPromise = Promise.reject(firebaseError);
}

// Convert storage key to Firebase path
// Uses hierarchical structure: "events/CODIGO" instead of "event:CODIGO"
const toFirebasePath = (key) => {
  // Converts "event:CODIGO" to "events/CODIGO"
  if (key.startsWith("event:")) {
    return "events/" + key.substring(6);
  }
  return key.replace(/:/g, "/");
};

// Convert Firebase path back to storage key
const fromFirebasePath = (path) => {
  // Converts "events/CODIGO" to "event:CODIGO"
  if (path.startsWith("events/")) {
    return "event:" + path.substring(7);
  }
  return path.replace(/\//g, ":");
};

// Helper to wait for authentication before operations
const waitForAuth = async () => {
  // Wait for initial initialization
  if (authReadyPromise) {
    try {
      await authReadyPromise;
    } catch {
      // Ignore init errors, we might still try to auth
    }
  }

  // If already authenticated, return true
  if (auth?.currentUser) return true;

  // Attempt anonymous authentication for unauthenticated users
  // This is required for creating events with strict security rules
  if (auth) {
    try {
      await signInAnonymously(auth);
      return true;
    } catch (error) {
      console.warn(
        "Auto-authentication failed (Anonymous Auth might be disabled in Firebase Console):",
        error
      );
      // Proceed without auth - rules might block writes, but reads might work
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
const createRecaptcha = async (
  containerId = "recaptcha-container",
  size = "invisible"
) => {
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
  let container = document.getElementById(containerId);
  if (!container) {
    console.warn(`createRecaptcha: container #${containerId} not found in DOM`);
    return null;
  }

  try {
    // AGGRESSIVE CLEANUP: Reset grecaptcha widget directly if it exists
    if (
      recaptchaWidgetId !== null &&
      typeof window !== "undefined" &&
      typeof window.grecaptcha !== "undefined"
    ) {
      try {
        window.grecaptcha.reset(recaptchaWidgetId);
        // console.log("Reset grecaptcha widget:", recaptchaWidgetId);
      } catch (e) {
        console.warn("Error resetting grecaptcha widget:", e);
      }
    }

    // Clear any existing Firebase verifier
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
        // console.log("Cleared Firebase recaptchaVerifier");
      } catch (e) {
        console.warn("Error clearing previous reCAPTCHA:", e);
      }
      recaptchaVerifier = null;
    }
    recaptchaWidgetId = null;

    // NUCLEAR OPTION: Completely replace the container element to ensure a fresh state
    // This is necessary because grecaptcha maintains internal state tied to DOM elements
    const parent = container.parentNode;
    if (parent) {
      const newContainer = document.createElement("div");
      newContainer.id = containerId;
      // Keep container visible for normal (checkbox) reCAPTCHA; hide when using invisible
      if (size === "normal") {
        newContainer.style.visibility = "visible";
        newContainer.style.height = "auto";
        newContainer.style.overflow = "visible";
      } else {
        newContainer.style.visibility = "hidden";
        newContainer.style.height = "0";
        newContainer.style.overflow = "hidden";
      }
      parent.replaceChild(newContainer, container);
      container = newContainer;
      // console.log("Replaced container element for fresh reCAPTCHA");
    } else {
      // Fallback: just clear innerHTML
      container.innerHTML = "";
    }

    /* console.log("Creating RecaptchaVerifier with:", {
      containerId,
      size,
      authExists: !!auth,
      authCurrentUser: auth?.currentUser?.uid || "none",
    }); */

    // Create RecaptchaVerifier following Firebase v9+ modular API
    // Signature: new RecaptchaVerifier(auth, containerOrId, parameters)
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: size,
      // Show badge inline for invisible (helps some environments)
      badge: size === "invisible" ? "inline" : undefined,
      callback: () => {
        // reCAPTCHA solved - will proceed with signInWithPhoneNumber
      },
      "expired-callback": () => {
        // Response expired - ask user to solve reCAPTCHA again
      },
    });

    // Pre-render the reCAPTCHA
    recaptchaWidgetId = await recaptchaVerifier.render();
    /* console.log(
      "reCAPTCHA rendered successfully, widget ID:",
      recaptchaWidgetId
    ); */

    return recaptchaVerifier;
  } catch (error) {
    console.error("createRecaptcha error:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
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
  if (
    recaptchaWidgetId !== null &&
    typeof window !== "undefined" &&
    typeof window.grecaptcha !== "undefined"
  ) {
    try {
      window.grecaptcha.reset(recaptchaWidgetId);
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
  }

  // If not already set from a provided country code, try Brazilian fallback
  if (!phoneE164) {
    if (digits.length === 10 || digits.length === 11) {
      // Brazilian number: add +55
      phoneE164 = `+55${digits}`;
    } else {
      throw new Error(
        "Phone number must include country code or be a valid Brazilian number (10-11 digits)."
      );
    }
  }

  // console.log("Sending verification to:", phoneE164);

  // ALWAYS clear and recreate reCAPTCHA to avoid stale widget references
  // This is necessary because React may have unmounted/remounted the container
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (e) {
      console.warn("Error clearing previous reCAPTCHA:", e);
    }
    recaptchaVerifier = null;
    recaptchaWidgetId = null;
  }

  await createRecaptcha();

  if (!recaptchaVerifier) {
    throw new Error(
      "Failed to create reCAPTCHA verifier. Make sure the page has a container with id 'recaptcha-container'."
    );
  }

  try {
    // Store phone for later use
    lastPhoneNumber = digits;

    // Call signInWithPhoneNumber
    lastConfirmationResult = await signInWithPhoneNumber(
      auth,
      phoneE164,
      recaptchaVerifier
    );
    return true;
  } catch (error) {
    console.error("sendPhoneVerification error:", error);
    // Reset reCAPTCHA on error as per Firebase documentation
    resetRecaptcha();

    // If the error looks like a malformed/failed captcha token, try a single retry
    // using a visible (normal) reCAPTCHA to recover from invisible-token MALFORMED cases.
    const msg = (error && (error.message || "")).toString();
    const code = (error && error.code) || "";
    const isCaptchaError = code === "auth/captcha-check-failed" || msg.includes("CAPTCHA_CHECK_FAILED") || msg.includes("captcha");

    if (isCaptchaError) {
      try {
        // Recreate a visible reCAPTCHA and retry once
        await createRecaptcha("recaptcha-container", "normal");
        if (!recaptchaVerifier) {
          throw new Error("Failed to create fallback reCAPTCHA verifier");
        }
        lastConfirmationResult = await signInWithPhoneNumber(auth, phoneE164, recaptchaVerifier);
        return true;
      } catch (retryErr) {
        console.error("Retry with visible reCAPTCHA failed:", retryErr);
        lastPhoneNumber = null;
        lastConfirmationResult = null;
        resetRecaptcha();
        // Augment error with actionable guidance
        const e = new Error(
          "Falha na verificação de reCAPTCHA. Verifique domínios autorizados no Firebase Auth e a configuração do reCAPTCHA Enterprise."
        );
        e.original = retryErr;
        throw e;
      }
    }

    lastPhoneNumber = null;
    lastConfirmationResult = null;
    throw error;
  }
};

const confirmPhoneCode = async (code) => {
  if (!lastConfirmationResult) throw new Error("No verification in progress");
  try {
    // If there's an existing authenticated user and it's anonymous, attempt
    // to link the phone credential to preserve the UID (prevents ownership loss).
    const currentUser = auth && auth.currentUser ? auth.currentUser : null;

    // Obtain verificationId from the confirmation result (available on web SDK)
    const verificationId = lastConfirmationResult?.verificationId || null;

    if (currentUser && currentUser.isAnonymous && verificationId) {
      try {
        const phoneCredential = PhoneAuthProvider.credential(verificationId, code);
        const linked = await linkWithCredential(currentUser, phoneCredential);
        const uid = linked.user?.uid || null;

        // Save verified phone hash to sessionStorage for session-based caching
        try {
          if (lastPhoneNumber && typeof sessionStorage !== "undefined") {
            const verifiedPhones = JSON.parse(
              sessionStorage.getItem("verifiedPhones") || "[]"
            );
            const normalizedPhone = normalizePhone(lastPhoneNumber);
            const phoneHash = await hashPhone(normalizedPhone);
            if (phoneHash && !verifiedPhones.includes(phoneHash)) {
              verifiedPhones.push(phoneHash);
              sessionStorage.setItem(
                "verifiedPhones",
                JSON.stringify(verifiedPhones)
              );
            }
          }
        } catch (err) {
          console.warn("Failed to save verified phone to sessionStorage:", err);
        }

        // clear temporary state
        lastConfirmationResult = null;
        lastPhoneNumber = null;

        return uid;
      } catch (linkError) {
        // Linking failed (credential may be in use). Fall back to confirming sign-in.
        console.warn("Linking anonymous user with phone credential failed:", linkError);
      }
    }

    // Default fallback: confirm and sign in with the phone credential
    const userCredential = await lastConfirmationResult.confirm(code);
    const uid = userCredential.user?.uid || null;

    // Save verified phone hash to sessionStorage for session-based caching
    try {
      if (lastPhoneNumber && typeof sessionStorage !== "undefined") {
        const verifiedPhones = JSON.parse(
          sessionStorage.getItem("verifiedPhones") || "[]"
        );
        const normalizedPhone = normalizePhone(lastPhoneNumber);
        const phoneHash = await hashPhone(normalizedPhone);
        if (phoneHash && !verifiedPhones.includes(phoneHash)) {
          verifiedPhones.push(phoneHash);
          sessionStorage.setItem(
            "verifiedPhones",
            JSON.stringify(verifiedPhones)
          );
        }
      }
    } catch (err) {
      console.warn("Failed to save verified phone to sessionStorage:", err);
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

/**
 * Check if a phone number has been verified in the current session.
 * @param {string} phone - Phone number to check
 * @returns {Promise<boolean>} - True if phone was verified in this session
 */
const isPhoneVerifiedInSession = async (phone) => {
  try {
    if (typeof sessionStorage === "undefined") return false;
    const verifiedPhones = JSON.parse(
      sessionStorage.getItem("verifiedPhones") || "[]"
    );
    const normalizedPhone = normalizePhone(phone);
    const phoneHash = await hashPhone(normalizedPhone);
    return phoneHash && verifiedPhones.includes(phoneHash);
  } catch (err) {
    console.warn("Error checking session verification:", err);
    return false;
  }
};

/**
 * Clear all verified phones from session (useful for logout/testing).
 */
const clearVerifiedPhonesSession = () => {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("verifiedPhones");
    }
  } catch (err) {
    console.warn("Error clearing verified phones session:", err);
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
    // Hash the phone number for privacy - never store plain phone in database keys
    const phoneHash = await hashPhone(normalizedPhone);
    if (!phoneHash) return;

    // Store under phones/{hashedPhone}/{eventCode} so a single phone can map to multiple events
    const phonePath = `phones/${phoneHash}/${eventCode}`;
    const dbRef = ref(database, phonePath);
    await set(dbRef, {
      updatedAt: Date.now(),
      uid: auth?.currentUser?.uid || null
    });
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
    // Hash the phone to match the stored key
    const phoneHash = await hashPhone(normalizedPhone);
    if (!phoneHash) return;

    const phonePath = eventCode
      ? `phones/${phoneHash}/${eventCode}`
      : `phones/${phoneHash}`;
    const dbRef = ref(database, phonePath);
    await remove(dbRef);
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
    // Hash the phone to look up the stored key
    const phoneHash = await hashPhone(normalizedPhone);
    if (!phoneHash) return null;

    const phonePath = `phones/${phoneHash}`;
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
  // Return all event codes associated with a phone.
  if (!database) return [];
  await waitForAuth();

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return [];

  try {
    // Hash the phone to look up the stored key
    const phoneHash = await hashPhone(normalizedPhone);
    if (!phoneHash) return [];

    const phonePath = `phones/${phoneHash}`;
    const dbRef = ref(database, phonePath);
    const snapshot = await get(dbRef);

    if (!snapshot.exists()) return [];
    const data = snapshot.val();

    // Legacy Support: Old single mapping format
    if (data && data.eventCode) {
      return [data.eventCode];
    }

    // New mapping: keys are event codes.
    // We return all keys associated with this phone hash. 
    // This supports recovery across sessions (where UID might differ) and legacy data.
    if (data && typeof data === "object") {
      return Object.keys(data);
    }

    return [];
  } catch (error) {
    console.warn("Error looking up phone index:", error);
    return [];
  }
};

// Exposes the storage API for those who need to wait
const firebaseStorage = {
  // Exposes the auth promise for those who need to wait
  waitForAuth,

  // Phone privacy utilities
  hashPhone,
  obfuscatePhone,
  deobfuscatePhone,
  maskPhone,
  isObfuscated,
  normalizePhone,

  // Phone index functions
  setPhoneIndex,
  removePhoneIndex,
  getEventCodeByPhone,
  getEventCodesByPhone,

  // Phone Auth helpers
  createRecaptcha,
  clearRecaptcha: () => {
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (e) {
        console.warn("Error clearing reCAPTCHA:", e);
      }
      recaptchaVerifier = null;
      recaptchaWidgetId = null;
    }
  },
  sendPhoneVerification,
  confirmPhoneCode,
  isPhoneAuthAvailable,
  isPhoneVerifiedInSession,
  clearVerifiedPhonesSession,
  // Expose auth state change listener
  onAuthStateChanged: (authStateChangeCallback) => (auth ? onAuthStateChanged(auth, authStateChangeCallback) : null),

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
      if (prefix.startsWith("event:")) {
        basePath = "events";
      }

      const dbRef = ref(database, basePath || undefined);
      const snapshot = await get(dbRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        // If we are listing events, the keys are the codes directly
        if (basePath === "events") {
          const keys = Object.keys(data).map((code) => `event:${code}`);
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

// Set metadata properties on firebaseStorage object
if (typeof window !== "undefined") {
  firebaseStorage.initError = initError;
  firebaseStorage.isAvailable = !!database;
}

export default firebaseStorage;
