let MENU = [];
let TOPPINGS = [];
let CONFIG = {};
let cart = [];
let activeItem = null;
let activeSize = null;
let activeQty = 1;

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";

async function init() {
  const [menuRes, toppingsRes, configRes] = await Promise.all([
    fetch("/menu.json").then((r) => r.json()),
    fetch("/toppings.json").then((r) => r.json()),
    fetch("/api/config").then((r) => r.json()).catch(() => ({})),
  ]);
  MENU = menuRes;
  TOPPINGS = toppingsRes;
  CONFIG = configRes || {};
  renderMenu();
  bindEvents();
}

function renderMenu() {
  const container = document.getElementById("menu-list");
  const categories = [...new Set(MENU.map((m) => m.category))];
  container.innerHTML = categories
    .map((cat) => {
      const items = MENU.filter((m) => m.category === cat);
      return (
        `<div class="menu-category">${cat}</div>` +
        items
          .map(
            (it) => `
        <div class="menu-item" data-id="${it.id}">
          <div>
            <div class="menu-item-name">${it.name}</div>
            <div class="menu-item-price">${Object.entries(it.prices)
              .map(([size, price]) => `${size}: ${fmt(price)}`)
              .join(" · ")}</div>
          </div>
          <button class="menu-item-add">+</button>
        </div>`
          )
          .join("")
      );
    })
    .join("");

  container.querySelectorAll(".menu-item").forEach((el) => {
    el.addEventListener("click", () => openItemModal(el.dataset.id));
  });
}

function openItemModal(id) {
  activeItem = MENU.find((m) => m.id === id);
  activeSize = Object.keys(activeItem.prices)[0];
  activeQty = 1;

  document.getElementById("modal-item-name").textContent = activeItem.name;

  const sizesEl = document.getElementById("modal-sizes");
  sizesEl.innerHTML = Object.entries(activeItem.prices)
    .map(([size, price]) => `<button type="button" class="chip" data-size="${size}">${size} - ${fmt(price)}</button>`)
    .join("");
  updateSizeChips();
  sizesEl.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeSize = chip.dataset.size;
      updateSizeChips();
      updateModalPrice();
    });
  });

  const toppingsEl = document.getElementById("modal-toppings");
  toppingsEl.innerHTML = TOPPINGS.map(
    (t) => `
    <label class="topping-item">
      <span>${t.name} (+${fmt(t.price)})</span>
      <input type="checkbox" value="${t.id}" />
    </label>`
  ).join("");
  toppingsEl.querySelectorAll("input").forEach((cb) => cb.addEventListener("change", updateModalPrice));

  document.getElementById("qty-value").textContent = activeQty;
  updateModalPrice();
  document.getElementById("item-modal").hidden = false;
}

function updateSizeChips() {
  document.querySelectorAll("#modal-sizes .chip").forEach((chip) => {
    chip.classList.toggle("selected", chip.dataset.size === activeSize);
  });
}

function getSelectedToppings() {
  return [...document.querySelectorAll("#modal-toppings input:checked")].map((cb) =>
    TOPPINGS.find((t) => t.id === cb.value)
  );
}

function updateModalPrice() {
  const base = activeItem.prices[activeSize];
  const toppingsTotal = getSelectedToppings().reduce((s, t) => s + t.price, 0);
  const total = (base + toppingsTotal) * activeQty;
  document.getElementById("modal-price").textContent = fmt(total);
}

function bindEvents() {
  document.getElementById("qty-minus").addEventListener("click", () => {
    activeQty = Math.max(1, activeQty - 1);
    document.getElementById("qty-value").textContent = activeQty;
    updateModalPrice();
  });
  document.getElementById("qty-plus").addEventListener("click", () => {
    activeQty += 1;
    document.getElementById("qty-value").textContent = activeQty;
    updateModalPrice();
  });
  document.getElementById("close-modal").addEventListener("click", () => {
    document.getElementById("item-modal").hidden = true;
  });

  document.getElementById("add-to-cart").addEventListener("click", () => {
    const toppings = getSelectedToppings();
    const base = activeItem.prices[activeSize];
    const unitPrice = base + toppings.reduce((s, t) => s + t.price, 0);
    cart.push({
      itemId: activeItem.id,
      name: activeItem.name,
      size: activeSize,
      toppings,
      qty: activeQty,
      unitPrice,
      lineTotal: unitPrice * activeQty,
    });
    document.getElementById("item-modal").hidden = true;
    renderCart();
  });

  document.getElementById("cart-fab").addEventListener("click", () => {
    document.getElementById("cart-drawer").hidden = false;
  });
  document.getElementById("close-cart").addEventListener("click", () => {
    document.getElementById("cart-drawer").hidden = true;
  });

  document.getElementById("checkout-form").addEventListener("submit", submitOrder);
  document.getElementById("new-order-btn").addEventListener("click", () => {
    cart = [];
    renderCart();
    document.getElementById("success-screen").hidden = true;
    document.getElementById("checkout-form").reset();
  });
}

function renderCart() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.lineTotal, 0);

  const fab = document.getElementById("cart-fab");
  fab.hidden = count === 0;
  document.getElementById("cart-count").textContent = count;
  document.getElementById("cart-total").textContent = fmt(total);
  document.getElementById("cart-summary-total").textContent = fmt(total);

  const itemsEl = document.getElementById("cart-items");
  itemsEl.innerHTML = cart
    .map((it, idx) => {
      const toppingStr = it.toppings.length ? ` + ${it.toppings.map((t) => t.name).join(", ")}` : "";
      return `
      <div class="cart-item">
        <div>
          <div><strong>${it.name}</strong> (${it.size}) x${it.qty}</div>
          <div class="menu-item-price">${toppingStr ? toppingStr.slice(3) : ""}</div>
          <div class="menu-item-price">${fmt(it.lineTotal)}</div>
        </div>
        <button type="button" class="cart-item-remove" data-idx="${idx}">Xoá</button>
      </div>`;
    })
    .join("");

  itemsEl.querySelectorAll(".cart-item-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      cart.splice(Number(btn.dataset.idx), 1);
      renderCart();
    });
  });
}

async function submitOrder(e) {
  e.preventDefault();
  if (cart.length === 0) return;

  const form = e.target;
  const submitBtn = document.getElementById("submit-order");
  submitBtn.disabled = true;
  submitBtn.textContent = "Đang gửi...";

  const payload = {
    customerName: form.customerName.value.trim(),
    phone: form.phone.value.trim(),
    address: form.address.value.trim(),
    note: form.note.value.trim(),
    paymentMethod: form.paymentMethod.value,
    items: cart,
    total: cart.reduce((s, i) => s + i.lineTotal, 0),
  };

  try {
    const res = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Lỗi không xác định");

    document.getElementById("cart-drawer").hidden = true;
    document.getElementById("success-code").textContent = data.orderCode;

    const qrBlock = document.getElementById("qr-block");
    if (payload.paymentMethod === "transfer" && CONFIG.bankBin && CONFIG.bankAccountNo) {
      const qrUrl = `https://img.vietqr.io/image/${CONFIG.bankBin}-${CONFIG.bankAccountNo}-compact2.png?amount=${payload.total}&addInfo=${encodeURIComponent(data.orderCode)}&accountName=${encodeURIComponent(CONFIG.bankAccountName || "")}`;
      document.getElementById("qr-image").src = qrUrl;
      document.getElementById("qr-account").textContent = `${CONFIG.bankAccountName || ""} - ${CONFIG.bankAccountNo}`;
      qrBlock.hidden = false;
    } else {
      qrBlock.hidden = true;
    }

    document.getElementById("success-screen").hidden = false;
  } catch (err) {
    alert("Đặt hàng thất bại: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Đặt hàng";
  }
}

init();
