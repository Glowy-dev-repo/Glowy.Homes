// Sentry in the browser loads after the page does, as its own chunk, so it stays out of the first
// load bundle (docs/05 Phase 6 task 6: under 250 KB). Errors before the load event are not
// reported; server errors are always captured by instrumentation.ts.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && typeof window !== "undefined") {
  const start = () =>
    void import("@sentry/nextjs").then((Sentry) =>
      Sentry.init({ dsn, tracesSampleRate: 0.1, dataCollection: { userInfo: false, cookies: false, httpBodies: [] } }),
    );
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
