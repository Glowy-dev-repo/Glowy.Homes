"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => string; remove: (id: string) => void };
  }
}

/** Cloudflare Turnstile widget; renders nothing when no site key is configured (development). */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let id: string | undefined;
    const tryRender = () => {
      if (window.turnstile && ref.current && !id) id = window.turnstile.render(ref.current, { sitekey: siteKey, callback: onToken });
    };
    const t = setInterval(tryRender, 200);
    tryRender();
    return () => {
      clearInterval(t);
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, onToken]);
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="lazyOnload" />
      <div ref={ref} />
    </>
  );
}
