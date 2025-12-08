/**
 * Cryptographic utilities for protecting sensitive data like phone numbers.
 * Uses Web Crypto API (available in all modern browsers).
 */

// Salt for hashing - makes rainbow table attacks harder
// This is public but combined with the phone creates a unique hash
const HASH_SALT = "amigo-secreto-2025-phone-salt";

/**
 * Creates a SHA-256 hash of a phone number for use as a database key.
 * This is a one-way hash - the original phone cannot be recovered.
 *
 * @param {string} phone - The normalized phone number (digits only)
 * @returns {Promise<string>} - A hex string hash safe for use as a Firebase key
 */
export async function hashPhone(phone) {
  if (!phone) return "";

  const normalized = String(phone).replace(/\D/g, "");
  if (!normalized) return "";

  const data = HASH_SALT + normalized;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Convert to hex string (Firebase-safe characters)
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Return first 32 chars (128 bits) - sufficient for uniqueness, shorter keys
  return hashHex.substring(0, 32);
}

/**
 * Masks a phone number for display, showing only last 4 digits.
 * Example: "(11) 98765-4321" -> "•••••••4321"
 *
 * @param {string} phone - The phone number (any format)
 * @returns {string} - Masked phone for display
 */
export function maskPhone(phone) {
  if (!phone) return "";

  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 4) return "••••";

  const lastFour = digits.slice(-4);
  const maskedPart = "•".repeat(Math.max(0, digits.length - 4));

  return maskedPart + lastFour;
}

/**
 * Simple XOR-based obfuscation for storing phone in database.
 * NOT cryptographically secure, but prevents casual reading.
 * The phone can be recovered with the same key.
 *
 * For true security, use server-side encryption with proper key management.
 *
 * @param {string} phone - The phone number to obfuscate
 * @param {string} key - A key (e.g., event code + participant id)
 * @returns {string} - Base64 encoded obfuscated string
 */
export function obfuscatePhone(phone, key) {
  if (!phone || !key) return phone || "";

  const normalized = String(phone).replace(/\D/g, "");
  if (!normalized) return "";

  // Simple XOR with repeating key
  const keyBytes = new TextEncoder().encode(key);
  const phoneBytes = new TextEncoder().encode(normalized);
  const result = new Uint8Array(phoneBytes.length);

  for (let i = 0; i < phoneBytes.length; i++) {
    result[i] = phoneBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  // Convert to base64 for safe storage
  return btoa(String.fromCharCode(...result));
}

/**
 * Reverses the obfuscation to get the original phone.
 *
 * @param {string} obfuscated - The base64 obfuscated string
 * @param {string} key - The same key used for obfuscation
 * @returns {string} - The original phone number (digits only)
 */
export function deobfuscatePhone(obfuscated, key) {
  if (!obfuscated || !key) return obfuscated || "";

  try {
    // Decode base64
    const decoded = atob(obfuscated);
    const obfuscatedBytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      obfuscatedBytes[i] = decoded.charCodeAt(i);
    }

    // Reverse XOR with same key
    const keyBytes = new TextEncoder().encode(key);
    const result = new Uint8Array(obfuscatedBytes.length);

    for (let i = 0; i < obfuscatedBytes.length; i++) {
      result[i] = obfuscatedBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return new TextDecoder().decode(result);
  } catch (e) {
    console.warn("Failed to deobfuscate phone:", e);
    return obfuscated; // Return as-is if decoding fails (might be plain text)
  }
}

/**
 * Checks if a string looks like an obfuscated phone (base64 format).
 *
 * @param {string} value - The value to check
 * @returns {boolean} - True if it looks obfuscated
 */
export function isObfuscated(value) {
  if (!value || typeof value !== "string") return false;

  // Obfuscated phones are base64 and typically 12-20 chars
  // Plain phones have digits, spaces, parentheses, dashes
  const hasPhoneChars = /[\s()-]/.test(value) || /^\d+$/.test(value);
  const looksLikeBase64 = /^[A-Za-z0-9+/]+=*$/.test(value) && value.length >= 8;

  return looksLikeBase64 && !hasPhoneChars;
}
