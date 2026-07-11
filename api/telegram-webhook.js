import { updateOrderStatus } from "./_lib/orders-store.js";

const STATUS_LABEL = {
  confirm: "✅ Đã xác nhận",
  making: "🧋 Đang pha chế",
  done: "📦 Đã pha xong, chờ giao/lấy",
  delivered: "🚚 Đã giao / khách đã nhận",
  cancel: "❌ Đã huỷ đơn",
};

const FINAL_STATES = new Set(["delivered", "cancel"]);

function stripOldStatusLine(text) {
  return text.replace(/\n*➡️ Trạng thái:.*$/s, "");
}

function extractOrderCode(text) {
  const m = /ĐƠN HÀNG MỚI - (\S+)/.exec(text || "");
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const expectedSecret = process.env.WEBHOOK_SECRET;
  const gotSecret = req.headers["x-telegram-bot-api-secret-token"];
  if (expectedSecret && gotSecret !== expectedSecret) {
    res.status(401).end();
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  let update = req.body;
  if (typeof update === "string") {
    try {
      update = JSON.parse(update);
    } catch {
      res.status(200).end();
      return;
    }
  }

  const cq = update && update.callback_query;
  if (!cq || !token) {
    res.status(200).end();
    return;
  }

  const action = cq.data;
  const label = STATUS_LABEL[action];
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const oldText = cq.message.text || "";

  if (!label) {
    await answerCallback(token, cq.id, "Không rõ hành động");
    res.status(200).end();
    return;
  }

  const baseText = stripOldStatusLine(oldText);
  const now = new Date();
  const timeStr = now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const newText = `${baseText}\n➡️ Trạng thái: ${label} (${timeStr})`;

  const isFinal = FINAL_STATES.has(action);
  const replyMarkup = isFinal
    ? undefined
    : {
        inline_keyboard: [
          [
            { text: "✅ Xác nhận", callback_data: "confirm" },
            { text: "🧋 Đang pha chế", callback_data: "making" },
          ],
          [
            { text: "📦 Đã xong", callback_data: "done" },
            { text: "🚚 Đã giao/khách nhận", callback_data: "delivered" },
          ],
          [{ text: "❌ Huỷ đơn", callback_data: "cancel" }],
        ],
      };

  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: newText,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      }),
    });
  } catch {
    // ignore, still answer callback below
  }

  const orderCode = extractOrderCode(baseText);
  if (orderCode) {
    await updateOrderStatus(orderCode, action);
  }

  await answerCallback(token, cq.id, `Đã cập nhật: ${label}`);
  res.status(200).end();
}

async function answerCallback(token, callbackQueryId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
    });
  } catch {
    // best effort
  }
}
