import { config } from "./config";

const BASE = `https://api.telegram.org/bot${config.telegram.botToken}`;

async function sendToChat(text: string): Promise<void> {
  try {
    const res = await fetch(`${BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(config.rpc.timeoutMs),
    });
    if (!res.ok) {
      console.error(`Telegram error: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("Failed to send message:", err);
  }
}

export async function sendAlert(
  amount: number,
  rawAmount: bigint,
  sender: string,
  recipient: string,
  txHash: string,
  usdPrice: number | null
): Promise<void> {
  const usdValue = usdPrice !== null ? amount * usdPrice : null;

  const usdLine =
    usdValue !== null
      ? `USD Value: ~$${usdValue.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} (@ $${usdPrice!.toFixed(4)} / ZIG)\n`
      : "USD Value: unavailable\n";

  const text =
    `🚨 Large ZIG Transfer Detected\n\n` +
    `Wallet: ${recipient}\n` +
    `Direction: Received\n\n` +
    `Sender: ${sender}\n` +
    `Recipient: ${recipient}\n\n` +
    `Amount: ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ZIG (${rawAmount.toLocaleString("en-US")} ${config.zig.denom})\n` +
    usdLine +
    `Type: Transfer\n\n` +
    `Tx: ${config.txExplorer}${txHash}`;

  console.log(text);
  console.log("=".repeat(50));
  await sendToChat(text);
}
