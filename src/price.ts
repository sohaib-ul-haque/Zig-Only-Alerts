import { config } from "./config";

let cachedPrice: number | null = null;
let cachedAt = 0;

/**
 * Returns the current ZIG/USD price, using a short-lived in-memory cache
 * so we don't hammer CoinGecko on every alert. Returns null if the price
 * can't be fetched (alert will still go out, just without the USD line).
 */
export async function getZigUsdPrice(): Promise<number | null> {
  const now = Date.now();
  if (cachedPrice !== null && now - cachedAt < config.price.cacheMs) {
    return cachedPrice;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${config.price.coingeckoId}&vs_currencies=usd`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      console.error(`[PRICE] CoinGecko error: ${res.status}`);
      return cachedPrice; // fall back to whatever we last had, if anything
    }

    const data = (await res.json()) as Record<string, { usd?: number }>;
    const usd = data?.[config.price.coingeckoId]?.usd;

    if (typeof usd !== "number") {
      console.error("[PRICE] Unexpected CoinGecko response shape:", data);
      return cachedPrice;
    }

    cachedPrice = usd;
    cachedAt = now;
    return cachedPrice;
  } catch (err) {
    console.error("[PRICE] Fetch failed:", (err as Error).message);
    return cachedPrice;
  }
}
