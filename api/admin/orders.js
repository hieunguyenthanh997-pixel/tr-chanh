import { listOrders } from "../_lib/orders-store.js";

export default async function handler(req, res) {
  const key = req.headers["x-admin-key"] || req.query.key;
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || key !== expected) {
    res.status(401).json({ ok: false, error: "Sai mật khẩu" });
    return;
  }

  const orders = await listOrders();
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, orders });
}
