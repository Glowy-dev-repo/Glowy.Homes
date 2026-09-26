import * as Sentry from "@sentry/nextjs";

// Sentry stays inert until SENTRY_DSN is set.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Lead forms carry names, emails and phones; none of it may reach Sentry (docs/02 section 8.6).
    dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
  });
}

export const onRequestError = Sentry.captureRequestError;
