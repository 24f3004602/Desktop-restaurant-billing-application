const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const BACKEND_URL = "http://127.0.0.1:8000";
const HEALTH_URL = `${BACKEND_URL}/health`;

let backendProc = null;
let backendStartError = null;

function resolveBackendDir() {
  const localBackendDir = path.resolve(__dirname, "..", "backend");
  if (fs.existsSync(path.join(localBackendDir, "app", "main.py"))) {
    return localBackendDir;
  }

  const resourcesPath = process.resourcesPath || "";
  const unpackedBackendDir = path.join(resourcesPath, "app.asar.unpacked", "backend");
  if (fs.existsSync(path.join(unpackedBackendDir, "app", "main.py"))) {
    return unpackedBackendDir;
  }

  const asarBackendDir = path.join(resourcesPath, "app.asar", "backend");
  if (fs.existsSync(path.join(asarBackendDir, "app", "main.py"))) {
    return asarBackendDir;
  }

  return localBackendDir;
}

function resolvePythonCommand(backendDir) {
  const repoDir = path.resolve(__dirname, "..");
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

async function waitForHealth(timeoutMs = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (backendStartError) {
      throw backendStartError;
    }

    if (backendProc && backendProc.exitCode !== null) {
      throw new Error(`FastAPI process exited with code ${backendProc.exitCode}`);
    }

    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // Wait and retry.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("FastAPI health check timed out");
}

async function startBackend() {
  if (backendProc) {
    return BACKEND_URL;
  }

  backendStartError = null;
  const backendDir = resolveBackendDir();
  const pythonCmd = process.env.BACKEND_PYTHON || resolvePythonCommand(backendDir);
  const uvicornArgs = [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
  ];

  backendProc = spawn(pythonCmd, uvicornArgs, {
    cwd: backendDir,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  backendProc.stdout.on("data", (chunk) => {
    console.log(`[fastapi] ${chunk.toString().trim()}`);
  });
  backendProc.stderr.on("data", (chunk) => {
    console.error(`[fastapi] ${chunk.toString().trim()}`);
  });

  backendProc.on("error", (error) => {
    backendStartError = new Error(`Failed to start FastAPI process: ${error.message}`);
  });

  backendProc.on("exit", () => {
    backendProc = null;
  });

  await waitForHealth();
  return BACKEND_URL;
}

function stopBackend() {
  if (!backendProc) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(backendProc.pid), "/f", "/t"], { windowsHide: true });
  } else {
    backendProc.kill("SIGTERM");
  }

  backendProc = null;
}

module.exports = {
  BACKEND_URL,
  startBackend,
  stopBackend,
};
