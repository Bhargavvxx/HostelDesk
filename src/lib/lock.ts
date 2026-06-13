/**
 * Web Crypto API implementation for secure PBKDF2 PIN hashing.
 */

// Generate a random salt
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return arrayBufferToBase64(salt)
}

// Convert a raw PIN into an ArrayBuffer for crypto operations
function getPinKeyMaterial(pin: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  )
}

/**
 * Hashes a PIN using PBKDF2-HMAC-SHA256 with 100,000 iterations.
 */
export async function hashPin(pin: string, saltBase64: string): Promise<string> {
  const salt = base64ToArrayBuffer(saltBase64)
  const keyMaterial = await getPinKeyMaterial(pin)
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256 // length of derived bits
  )
  
  return arrayBufferToBase64(hashBuffer)
}

/**
 * Validates an entered PIN against a stored hash and salt.
 * Uses a safe byte-array comparison to resist timing attacks.
 */
export async function verifyPin(enteredPin: string, storedHashBase64: string, saltBase64: string): Promise<boolean> {
  const derivedHashBase64 = await hashPin(enteredPin, saltBase64)
  
  const derivedHashBuffer = base64ToArrayBuffer(derivedHashBase64)
  const storedHashBuffer = base64ToArrayBuffer(storedHashBase64)
  
  // Safe comparison
  if (derivedHashBuffer.byteLength !== storedHashBuffer.byteLength) return false
  
  const a = new Uint8Array(derivedHashBuffer)
  const b = new Uint8Array(storedHashBuffer)
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!
  }
  return result === 0
}

// Helpers for Base64 <-> ArrayBuffer
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64)
  const len = binary_string.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i)!
  }
  return bytes.buffer
}
