/**
 * Anonymous browser-based creator identity.
 * Generates a UUID on first visit and persists it in localStorage.
 */

const CREATOR_ID_KEY = "lottie-studio-creator-id";
const CREATOR_NAME_KEY = "lottie-studio-creator-name";

function hasStorage(): boolean {
  return typeof localStorage !== "undefined";
}

/**
 * Get the creator ID from localStorage, creating one if it doesn't exist.
 */
export function getCreatorId(): string {
  if (!hasStorage()) return "";

  let id = localStorage.getItem(CREATOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CREATOR_ID_KEY, id);
  }
  return id;
}

/**
 * Get the creator's display name from localStorage.
 */
export function getCreatorName(): string | null {
  if (!hasStorage()) return null;
  return localStorage.getItem(CREATOR_NAME_KEY);
}

/**
 * Set the creator's display name in localStorage.
 */
export function setCreatorName(name: string): void {
  if (!hasStorage()) return;
  localStorage.setItem(CREATOR_NAME_KEY, name);
}
