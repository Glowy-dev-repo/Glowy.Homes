import "server-only";
import { createRateLimiter } from "./rate-limit";

// Sign in links per address: stops anyone flooding someone else's inbox with sign in emails. Shared by
// the sign in form (server action) and the Auth.js endpoint, which can be called directly.
const perHour = Number(process.env.SIGNIN_EMAILS_PER_HOUR ?? 10);
const emailLimiter = createRateLimiter(perHour / 60, Date.now, Math.min(perHour, 5));

export function signInEmailAllowed(email: string): boolean {
  return emailLimiter(email.trim().toLowerCase());
}
