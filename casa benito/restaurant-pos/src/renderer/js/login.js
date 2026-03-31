const authAPI = window.authAPI;

const el = {
  authModeLabel: document.getElementById("authModeLabel"),
  authForm: document.getElementById("authForm"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  confirmWrap: document.getElementById("confirmWrap"),
  confirmPasswordInput: document.getElementById("confirmPasswordInput"),
  authSubmitBtn: document.getElementById("authSubmitBtn"),
  statusMessage: document.getElementById("statusMessage")
};

let setupMode = false;

function showStatus(message, isError = false) {
  el.statusMessage.textContent = message;
  el.statusMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
}

async function callAuth(method, payload) {
  if (!authAPI || typeof authAPI[method] !== "function") {
    throw new Error("Auth API unavailable");
  }
  const response = await authAPI[method](payload);
  if (!response.ok) {
    throw new Error(response.error || "Auth operation failed");
  }
  return response.data;
}

async function configureMode() {
  const data = await callAuth("isConfigured");
  setupMode = !data.configured;

  if (setupMode) {
    el.authModeLabel.textContent = "Initial Admin Setup";
    el.authSubmitBtn.textContent = "Create Admin";
    el.confirmWrap.classList.remove("hidden");
    el.confirmPasswordInput.required = true;
  } else {
    el.authModeLabel.textContent = "Admin Login";
    el.authSubmitBtn.textContent = "Login";
    el.confirmWrap.classList.add("hidden");
    el.confirmPasswordInput.required = false;
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    const username = el.usernameInput.value.trim();
    const password = el.passwordInput.value;

    if (setupMode) {
      const confirmPassword = el.confirmPasswordInput.value;
      if (password !== confirmPassword) {
        showStatus("Passwords do not match", true);
        return;
      }

      await callAuth("setupAdmin", { username, password });
      await configureMode();
      showStatus("Admin created. Please login.");
      el.passwordInput.value = "";
      el.confirmPasswordInput.value = "";
      return;
    }

    const session = await callAuth("login", { username, password });
    localStorage.setItem("auth_token", session.token);
    window.location.href = "./index.html";
  } catch (error) {
    showStatus(error.message, true);
  }
}

function init() {
  const token = localStorage.getItem("auth_token") || "";
  if (token) {
    authAPI.getSession({ token }).then((response) => {
      if (response.ok) {
        window.location.href = "./index.html";
      }
    });
  }

  el.authForm.addEventListener("submit", handleSubmit);
  configureMode().catch((error) => showStatus(error.message, true));
}

init();
