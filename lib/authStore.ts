/**
 * Plain-module snapshot of the logged-in user, for callers that can't use hooks
 * (services/api.ts and anything else outside a React render). AuthProvider is the
 * only writer - it keeps this in sync with its own state, so React stays the
 * source of truth and this is just a mirror for non-React code.
 */
export type AuthUser = Record<string, unknown>;

let currentUser: AuthUser | null = null;

export function setCurrentUser(user: AuthUser | null): void {
  currentUser = user;
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}
