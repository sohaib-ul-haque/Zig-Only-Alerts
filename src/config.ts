import "dotenv/config";
import { decimalToRaw } from "./amount";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

const zigDecimals = parseInt(requireEnv("ZIG_DECIMALS"), 10);
if (!Number.isSafeInteger(zigDecimals) || zigDecimals < 0) {
  throw new Error(`Invalid ZIG_DECIMALS: ${requireEnv("ZIG_DECIMALS")}`);
}
const zigThreshold = requireEnv("THRESHOLD_ZIG");

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
    decimals: zigDecimals,
    minThreshold: parseFloat(zigThreshold),
    minThresholdRaw: decimalToRaw(zigThreshold, zigDecimals),
  },
  price: {
    coingeckoId: process.env.COINGECKO_ID ?? "zignaly",
    cacheMs: parseInt(process.env.PRICE_CACHE_MS ?? "60000"),
  },
};
