const fmt = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";

const STATUS_LABEL = {
  new: "🆕 Đơn mới",
  confirm: "✅ Đã xác nhận",
  making: "🧋 Đang pha chế",
  done: "📦 Đã xong",
  delivered: "🚚 Đã giao",
  cancel: "❌ Đã huỷ",
};

function getKey() {
  return sessionStorage.getItem("adminKey");
}

function showDashboard() {
  document.getElementById("login-screen").hidden = true;
  document.getElementById("dashboard").hidden = false;
  loadOrders();
}

async function loadOrders() {
  const key = getKey();
  const res = await fetch("/api/admin/orders", { headers: { "x-admin-key": key } });
  if (res.status === 401) {
    sessionStorage.removeItem("adminKey");
    location.reload();
    return;
  }
  const data = await res.json();
  renderStats(data.orders);
  renderOrders(data.orders);
}

function renderStats(orders) {
  const total = orders.length;
  const active = orders.filter((o) => !["delivered", "cancel"].includes(o.status)).length;
  const revenue = orders
    .filter((o) => o.status !== "cancel")
    .reduce((s, o) => s + Number(o.total || 0), 0);

  document.getElementById("stats-row").innerHTML = `
    <div class="stat-chip">Tổng đơn<strong>${total}</strong></div>
    <div class="stat-chip">Đang xử lý<strong>${active}</strong></div>
    <div class="stat-chip">Doanh thu<strong>${fmt(revenue)}</strong></div>
  `;
}

function renderOrders(orders) {
  const list = document.getElementById("orders-list");
  if (orders.length === 0) {
    list.innerHTML = `<div class="empty-state">Chưa có đơn hàng nào</div>`;
    return;
  }
  list.innerHTML = orders
    .map((o) => {
      const itemsStr = (o.items || [])
        .map((it) => `${it.name} (${it.size}) x${it.qty}`)
        .join(", ");
      const time = o.createdAt ? new Date(o.createdAt).toLocaleString("vi-VN") : "";
      return `
      <div class="order-card">
        <div class="order-top">
          <span class="order-code">${o.orderCode}</span>
          <span class="order-status">${STATUS_LABEL[o.status] || o.status}</span>
        </div>
        <div class="order-meta">
          ${time}<br/>
          👤 ${o.customerName} · 📞 ${o.phone}<br/>
          ${o.address ? `📍 ${o.address}` : "📍 Tự đến lấy"} · 💳 ${o.paymentMethod === "transfer" ? "Chuyển khoản" : "COD"}
        </div>
        <div class="order-items">${itemsStr}</div>
        <div class="order-total">${fmt(o.total)}</div>
      </div>`;
    })
    .join("");
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pwd = document.getElementById("password-input").value;
  const res = await fetch("/api/admin/orders", { headers: { "x-admin-key": pwd } });
  if (res.ok) {
    sessionStorage.setItem("adminKey", pwd);
    showDashboard();
  } else {
    document.getElementById("login-error").hidden = false;
  }
});

document.getElementById("refresh-btn").addEventListener("click", loadOrders);
document.getElementById("logout-btn").addEventListener("click", () => {
  sessionStorage.removeItem("adminKey");
  location.reload();
});

if (getKey()) {
  showDashboard();
}
