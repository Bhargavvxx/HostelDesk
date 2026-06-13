/**
 * Local database and general helper utilities.
 */

/**
 * Generates a standard UUIDv4 for local entities.
 * Uses the native Web Crypto API.
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Returns the current timestamp as a standard UTC ISO 8601 string.
 * Used for updated_at, created_at, and general timestamps.
 */
export function nowUTCISO(): string {
  return new Date().toISOString()
}

/**
 * Returns the IST calendar date key (YYYY-MM-DD) for a given UTC Date.
 * Used for attendance and movement day boundaries per the PRD.
 *
 * @param date Optional Date object. Defaults to current date.
 */
export function getISTDateKey(date: Date = new Date()): string {
  // Convert date to IST (+5:30 offset) and format as YYYY-MM-DD
  const istFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  // en-CA formats nicely as YYYY-MM-DD
  return istFormatter.format(date)
}
