const DATA_BRANCH = "data";
const DATA_PATH = "data/orders.json";

function repoInfo() {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return null;
  return { repo, token };
}

async function ghFetch(path, token, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      ...(options.headers || {}),
    },
  });
  return res;
}

async function readOrdersRaw() {
  const info = repoInfo();
  if (!info) return { orders: [], sha: null };
  const res = await ghFetch(`${info.repo}/contents/${DATA_PATH}?ref=${DATA_BRANCH}`, info.token);
  if (!res.ok) return { orders: [], sha: null };
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  let orders = [];
  try {
    orders = JSON.parse(content);
  } catch {
    orders = [];
  }
  return { orders, sha: data.sha };
}

async function writeOrdersRaw(orders, sha, message) {
  const info = repoInfo();
  if (!info) return false;
  const content = Buffer.from(JSON.stringify(orders, null, 2)).toString("base64");
  const res = await ghFetch(`${info.repo}/contents/${DATA_PATH}`, info.token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, branch: DATA_BRANCH, sha: sha || undefined }),
  });
  return res.ok;
}

export async function appendOrder(order) {
  try {
    const { orders, sha } = await readOrdersRaw();
    orders.push(order);
    await writeOrdersRaw(orders, sha, `order ${order.orderCode}`);
  } catch {
    // best effort - don't break checkout if data store write fails
  }
}

export async function updateOrderStatus(orderCode, status) {
  try {
    const { orders, sha } = await readOrdersRaw();
    const idx = orders.findIndex((o) => o.orderCode === orderCode);
    if (idx === -1) return false;
    orders[idx].status = status;
    orders[idx].updatedAt = new Date().toISOString();
    await writeOrdersRaw(orders, sha, `update ${orderCode} -> ${status}`);
    return true;
  } catch {
    return false;
  }
}

export async function listOrders() {
  const { orders } = await readOrdersRaw();
  return orders.slice().reverse();
}
