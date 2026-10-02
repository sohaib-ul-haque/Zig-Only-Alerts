import WebSocket from "ws";
import { config } from "./config";
import { sendAlert } from "./telegram";
import { getZigUsdPrice } from "./price";
import { parseRawAmount, rawToDecimalString } from "./amount";

interface FlatEvents {
  [key: string]: string[];
}

function first(events: FlatEvents, key: string): string | undefined {
  return events[key]?.[0];
}

function parseAmount(raw: string): { amountRaw: bigint; denom: string } | null {
  // Pure digits - denom comes from separate field
  if (/^\d+$/.test(raw)) {
    return { amountRaw: parseRawAmount(raw), denom: "" };
  }

  // Combined string like "500000azig"
  if (raw.includes(config.zig.denom)) {
    const amountPart = raw.replace(config.zig.denom, "").trim();
    if (/^\d+$/.test(amountPart)) {
      return { amountRaw: parseRawAmount(amountPart), denom: config.zig.denom };
    }
  }

  return null;
}

interface Candidate {
  sender: string;
  recipient: string;
  amountRaw: bigint;
}

/**
 * A single tx packs MANY transfer events into parallel arrays — e.g. one
 * event for the gas fee, plus one or more for the actual message being
 * executed. transfer.sender[i], transfer.recipient[i], and
 * transfer.amount[i] line up by index. Reading only index [0] (as the
 * earlier version did) means we only ever see the gas fee transfer, since
 * it's almost always emitted first. We need to scan every index.
 */
function collectCandidates(events: FlatEvents): Candidate[] {
  const senders = events["transfer.sender"] ?? [];
  const recipients = events["transfer.recipient"] ?? [];
  const amounts = events["transfer.amount"] ?? [];

  const len = Math.max(senders.length, recipients.length, amounts.length);
  const candidates: Candidate[] = [];

  for (let i = 0; i < len; i++) {
    const sender = senders[i];
    const recipient = recipients[i];
    const rawAmount = amounts[i];
    if (!sender || !recipient || !rawAmount) continue;

    const parsed = parseAmount(rawAmount);
    if (!parsed) continue;

    const denom = parsed.denom || config.zig.denom;
    if (denom !== config.zig.denom) continue;
    candidates.push({ sender, recipient, amountRaw: parsed.amountRaw });
  }

  return candidates;
}

async function processFlatEvents(events: FlatEvents): Promise<void> {
  const txHash = first(events, "tx.hash");
  if (!txHash) return;

  console.log(`\n[PROCESSING] TX: ${txHash}`);

  const candidates = collectCandidates(events);

  if (candidates.length === 0) {
    console.log(`[SKIP] No ZIG transfer events found`);
    return;
  }

  console.log(`  Found ${candidates.length} ZIG transfer event(s) in this tx`);

  // A tx can legitimately contain multiple qualifying transfers (e.g.
  // multi-send). Check each one independently against the threshold.
  for (const { sender, recipient, amountRaw } of candidates) {
    // Threshold decisions use exact raw integers. Number is used only for
    // the existing human-facing log/Telegram/USD presentation.
    const humanAmount = Number(rawToDecimalString(amountRaw, config.zig.decimals));

    console.log(
      `    ${sender.slice(0, 12)}... -> ${recipient.slice(0, 12)}...  ` +
      `${humanAmount.toLocaleString()} ZIG (threshold: ${config.zig.minThreshold})`
    );

    if (amountRaw < config.zig.minThresholdRaw) {
      continue;
    }

    console.log(`    ✅ THRESHOLD MET - SENDING ALERT`);
    const usdPrice = await getZigUsdPrice();
    await sendAlert(humanAmount, amountRaw, sender, recipient, txHash, usdPrice);
  }
}

function parseWsMessage(raw: string): FlatEvents | null {
  try {
    const msg = JSON.parse(raw);
    const events: FlatEvents = msg?.result?.events;
    if (!events || typeof events !== "object") return null;
    if (!("tx.hash" in events)) return null;
    return events;
  } catch {
    return null;
  }
}

export function startMonitor(): void {
  let reconnectDelay = 2000;

  function connect(): void {
    console.log(`Connecting to ZigChain WebSocket: ${config.rpc.ws}`);
    const ws = new WebSocket(config.rpc.ws);

    ws.on("open", () => {
      reconnectDelay = 2000;
      console.log("WebSocket connected. Subscribing to Tx events...");
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "subscribe",
          id: "tx-monitor",
          params: { query: "tm.event='Tx'" },
        })
      );
    });

    ws.on("message", (data: WebSocket.RawData) => {
      const raw = data.toString();
      const events = parseWsMessage(raw);
      if (!events) return;

      console.log(`[TX RECEIVED] hash=${first(events, "tx.hash")}`);

      processFlatEvents(events).catch((err) =>
        console.error("[ERROR] Processing tx:", err)
      );
    });

    ws.on("error", (err) => {
      console.error("[WS ERROR]:", err.message);
    });

    ws.on("close", (code, reason) => {
      console.warn(
        `[WS CLOSED] code=${code} reason=${reason.toString() || "none"}. ` +
        `Reconnecting in ${reconnectDelay / 1000}s...`
      );
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
        connect();
      }, reconnectDelay);
    });
  }

  connect();
}
