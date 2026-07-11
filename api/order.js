const STATUS_LABEL = {
  new: "🆕 Đơn mới - chờ xác nhận",
};

function genOrderCode() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DH${y}${m}${d}-${rand}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    res.status(500).json({ ok: false, error: "Server chưa cấu hình Telegram" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ ok: false, error: "Dữ liệu không hợp lệ" });
      return;
    }
  }

  const { customerName, phone, address, note, paymentMethod, items, total } = body || {};

  if (!customerName || !phone || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ ok: false, error: "Thiếu thông tin đặt hàng" });
    return;
  }

  const orderCode = genOrderCode();

  const itemLines = items
    .map((it) => {
      const toppingStr = it.toppings && it.toppings.length ? ` + ${it.toppings.map((t) => t.name).join(", ")}` : "";
      return `• ${escapeHtml(it.name)} (${escapeHtml(it.size)}) x${it.qty}${escapeHtml(toppingStr)} - ${Number(it.lineTotal).toLocaleString("vi-VN")}đ`;
    })
    .join("\n");

  const paymentLabel = paymentMethod === "transfer" ? "Chuyển khoản QR" : "Tiền mặt (COD)";

  const text =
    `🧋 <b>ĐƠN HÀNG MỚI - ${orderCode}</b>\n\n` +
    `👤 Khách: <b>${escapeHtml(customerName)}</b>\n` +
    `📞 SĐT: <b>${escapeHtml(phone)}</b>\n` +
    (address ? `📍 Địa chỉ: ${escapeHtml(address)}\n` : `📍 Khách tự đến lấy\n`) +
    `💳 Thanh toán: ${paymentLabel}\n` +
    (note ? `📝 Ghi chú: ${escapeHtml(note)}\n` : "") +
    `\n<b>Chi tiết:</b>\n${itemLines}\n\n` +
    `💰 <b>Tổng: ${Number(total).toLocaleString("vi-VN")}đ</b>\n\n` +
    `➡️ Trạng thái: ${STATUS_LABEL.new}`;

  const replyMarkup = {
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
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      }),
    });
    const tgData = await tgRes.json();
    if (!tgData.ok) {
      res.status(502).json({ ok: false, error: "Không gửi được lên Telegram", detail: tgData.description });
      return;
    }
  } catch (err) {
    res.status(502).json({ ok: false, error: "Lỗi kết nối Telegram" });
    return;
  }

  res.status(200).json({ ok: true, orderCode });
}
