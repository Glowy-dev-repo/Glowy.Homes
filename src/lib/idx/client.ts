// Minimal IDX Broker API client (https://api.idxbroker.com). Read calls only; 204 means "nothing".
// The key comes from IDX Broker, Home, Access Control, API Key, and lives only in the environment.

const BASE = "https://api.idxbroker.com";

export type IdxClient = { get(path: string): Promise<unknown | null> };

export function idxApiKey(): string | null {
  const v = process.env.IDX_BROKER_API_KEY?.trim();
  return v && !/replace_me|replace_with/i.test(v) ? v : null;
}

export function idxClient(key: string, fetchImpl: typeof fetch = fetch): IdxClient {
  return {
    async get(path) {
      // Pagination links come back as full URLs; only ever follow them on the API host.
      const url = path.startsWith("https://") ? path : `${BASE}${path}`;
      if (!url.startsWith(`${BASE}/`)) throw new Error(`Refusing to call ${url}`);
      const res = await fetchImpl(url, {
        headers: { accesskey: key, outputtype: "json", apiversion: "1.8.0" },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 204) return null;
      if (!res.ok) throw new Error(`IDX Broker ${res.status} on ${url.slice(BASE.length)}: ${(await res.text()).slice(0, 200)}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    },
  };
}
