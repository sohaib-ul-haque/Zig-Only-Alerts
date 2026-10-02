import "dotenv/config";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  telegram: {
    botToken: requireEnv("ONCHAIN_BOT_TOKEN"),
    chatId: requireEnv("ALERT_CHAT_ID"), // fixed supergroup, e.g. -1004399156891
  },
  rpc: {
    http: requireEnv("ZIG_RPC_HTTP"),
    ws: requireEnv("ZIG_RPC_WS"),
    timeoutMs: parseInt(process.env.RPC_TIMEOUT_MS ?? "10000"),
  },
  txExplorer: requireEnv("TX_EXPLORER"),
  zig: {
    denom: requireEnv("ZIG_DENOM"),
    decimals: parseInt(requireEnv("ZIG_DECIMALS")),
    minThreshold: parseFloat(requireEnv("THRESHOLD_ZIG")),
  },
  price: {
    coingeckoId: process.env.COINGECKO_ID ?? "zignaly",
    cacheMs: parseInt(process.env.PRICE_CACHE_MS ?? "60000"),
  },
};
