const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const tmpDir = path.join(__dirname, "..", ".tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const runId = Date.now();
const testDbPath = path.join(tmpDir, `pos-fastapi-smoke-${runId}.db`);
const testPort = String(18000 + Math.floor(Math.random() * 500));
const backendDir = path.join(__dirname, "..", "..", "backend");
const baseUrl = `http://127.0.0.1:${testPort}`;
const apiBase = `${baseUrl}/api/v1`;

let backendProc = null;
let token = "";
let backendLog = "";
let seq = 0;

function resolvePythonCommand() {
  const repoDir = path.resolve(__dirname, "..", "..");
  const candidates = process.platform === "win32"
    ? [
      path.join(backendDir, ".venv", "Scripts", "python.exe"),
      path.join(repoDir, ".venv", "Scripts", "python.exe"),
      "python",
      "py"
    ]
    : [
      path.join(backendDir, ".venv", "bin", "python"),
      path.join(repoDir, ".venv", "bin", "python"),
      "python3",
      "python"
    ];

  for (const candidate of candidates) {
    if (!candidate.includes(path.sep) || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === "win32" ? "python" : "python3";
}

async function waitForHealth(timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (backendProc && backendProc.exitCode !== null) {
      throw new Error(`Backend exited early with code ${backendProc.exitCode}\n${backendLog}`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // retry
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Backend health check timed out\n${backendLog}`);
}

async function startBackend() {
  const python = resolvePythonCommand();
  backendProc = spawn(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", testPort],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        DATABASE_PATH: testDbPath,
        DEFAULT_ADMIN_USERNAME: "admin",
        DEFAULT_ADMIN_PASSWORD: "admin123"
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  );

  backendProc.stdout.on("data", (chunk) => {
    backendLog += chunk.toString();
  });
  backendProc.stderr.on("data", (chunk) => {
    backendLog += chunk.toString();
  });

  await waitForHealth();
}

function waitForProcessExit(proc, timeoutMs = 5000) {
  if (!proc || proc.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finalize = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    proc.once("exit", finalize);
    proc.once("error", finalize);
    setTimeout(finalize, timeoutMs);
  });
}

async function stopBackend() {
  if (!backendProc) {
    return;
  }

  const proc = backendProc;
  backendProc = null;

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"], {
      windowsHide: true,
      stdio: "ignore"
    });
    await new Promise((resolve) => {
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });
  } else {
    proc.kill("SIGTERM");
  }

  await waitForProcessExit(proc);
}

async function request(method, pathname, body = undefined, useAuth = true) {
  const headers = { "Content-Type": "application/json" };
  if (useAuth) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      data = text;
    }
  }

  return { response, data };
}

function uniqueName(prefix) {
  seq += 1;
  return `${prefix}-${runId}-${seq}`;
}

async function loginAsAdmin() {
  const { response, data } = await request("POST", "/auth/login", {
    username: "admin",
    password: "admin123"
  }, false);

  assert.equal(response.status, 200, `Login failed: ${JSON.stringify(data)}`);
  assert.ok(data.access_token, "Expected access token from login");
  token = data.access_token;
}

async function createOrderWithOneItem({ dineIn }) {
  const categoryName = uniqueName("cat");
  const tableNumber = uniqueName("T").toUpperCase();

  const categoryRes = await request("POST", "/categories", {
    name: categoryName,
    display_order: 0,
    is_active: true
  });
  assert.equal(categoryRes.response.status, 201, `Create category failed: ${JSON.stringify(categoryRes.data)}`);

  const menuItemRes = await request("POST", "/menu-items", {
    category_id: categoryRes.data.id,
    name: uniqueName("item"),
    description: "Smoke test item",
    price_cents: 5000,
    gst_percent: 5,
    is_available: true
  });
  assert.equal(menuItemRes.response.status, 201, `Create menu item failed: ${JSON.stringify(menuItemRes.data)}`);

  let tableId = null;
  if (dineIn) {
    const tableRes = await request("POST", "/tables", {
      table_number: tableNumber,
      seats: 4,
      status: "free",
      is_active: true
    });
    assert.equal(tableRes.response.status, 201, `Create table failed: ${JSON.stringify(tableRes.data)}`);
    tableId = tableRes.data.id;
  }

  const orderRes = await request("POST", "/orders", {
    table_id: tableId,
    order_type: dineIn ? "dine_in" : "takeaway",
    notes: "Smoke test"
  });
  assert.equal(orderRes.response.status, 201, `Create order failed: ${JSON.stringify(orderRes.data)}`);

  const addItemRes = await request("POST", `/orders/${orderRes.data.id}/items`, {
    menu_item_id: menuItemRes.data.id,
    quantity: 1,
    special_note: null
  });
  assert.equal(addItemRes.response.status, 200, `Add order item failed: ${JSON.stringify(addItemRes.data)}`);

  return {
    order: addItemRes.data,
    tableId
  };
}

test.before(async () => {
  await startBackend();
  await loginAsAdmin();
});

test.after(async () => {
  await stopBackend();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

test("smoke: order to billed to paid lifecycle", async () => {
  const { order, tableId } = await createOrderWithOneItem({ dineIn: true });

  const kotRes = await request("POST", `/orders/${order.id}/kot`, {});
  assert.equal(kotRes.response.status, 200);
  assert.equal(kotRes.data.items_sent, 1);

  const billRes = await request("POST", `/billing/orders/${order.id}/bill`, { discount_cents: 0 });
  assert.equal(billRes.response.status, 200, `Generate bill failed: ${JSON.stringify(billRes.data)}`);
  assert.equal(billRes.data.payment_status, "unpaid");
  assert.ok(billRes.data.grand_total_cents > 0);

  const paymentRes = await request("POST", `/bills/${billRes.data.id}/payments`, {
    method: "cash",
    amount_cents: billRes.data.grand_total_cents,
    reference_no: null
  });
  assert.equal(paymentRes.response.status, 201, `Add payment failed: ${JSON.stringify(paymentRes.data)}`);

  const latestBill = await request("GET", `/billing/${billRes.data.id}`);
  assert.equal(latestBill.response.status, 200);
  assert.equal(latestBill.data.payment_status, "paid");

  const latestOrder = await request("GET", `/orders/${order.id}`);
  assert.equal(latestOrder.response.status, 200);
  assert.equal(latestOrder.data.status, "paid");

  const tablesRes = await request("GET", "/tables");
  assert.equal(tablesRes.response.status, 200);
  const table = tablesRes.data.find((entry) => entry.id === tableId);
  assert.ok(table, "Expected created table in table list");
  assert.equal(table.status, "free");
});

test("smoke: split payment and overpay rejection", async () => {
  const { order } = await createOrderWithOneItem({ dineIn: false });

  const billRes = await request("POST", `/billing/orders/${order.id}/bill`, { discount_cents: 0 });
  assert.equal(billRes.response.status, 200);

  const total = billRes.data.grand_total_cents;
  const partial = Math.max(1, Math.floor(total * 0.6));

  const payment1 = await request("POST", `/bills/${billRes.data.id}/payments`, {
    method: "upi",
    amount_cents: partial,
    reference_no: "SMOKE-UPI-1"
  });
  assert.equal(payment1.response.status, 201);

  const midBill = await request("GET", `/billing/${billRes.data.id}`);
  assert.equal(midBill.response.status, 200);
  assert.equal(midBill.data.payment_status, "partial");

  const overpay = await request("POST", `/bills/${billRes.data.id}/payments`, {
    method: "card",
    amount_cents: total,
    reference_no: "TOO-MUCH"
  });
  assert.equal(overpay.response.status, 400);
  assert.match(String(overpay.data?.error?.message || ""), /exceeds remaining amount/i);

  const remaining = total - partial;
  const payment2 = await request("POST", `/bills/${billRes.data.id}/payments`, {
    method: "card",
    amount_cents: remaining,
    reference_no: "SMOKE-CARD-2"
  });
  assert.equal(payment2.response.status, 201);

  const allPayments = await request("GET", `/bills/${billRes.data.id}/payments`);
  assert.equal(allPayments.response.status, 200);
  assert.equal(allPayments.data.length, 2);

  const finalBill = await request("GET", `/billing/${billRes.data.id}`);
  assert.equal(finalBill.response.status, 200);
  assert.equal(finalBill.data.payment_status, "paid");
});
