const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { db } = require("../db");

const SESSION_HOURS = 12;
const USER_ROLE = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  CASHIER: "CASHIER"
};

const ROLE_RANK = {
  [USER_ROLE.CASHIER]: 1,
  [USER_ROLE.MANAGER]: 2,
  [USER_ROLE.ADMIN]: 3
};

function isConfigured() {
  const count = db.prepare("SELECT COUNT(*) AS total FROM Users").get().total;
  return Number(count) > 0;
}

function createInitialAdmin({ username, password }) {
  if (isConfigured()) {
    throw new Error("System is already configured");
  }

  const user = String(username || "").trim();
  const pass = String(password || "");
  if (!user || pass.length < 6) {
    throw new Error("Username and password (min 6 chars) are required");
  }

  const passwordHash = bcrypt.hashSync(pass, 12);
  db.prepare("INSERT INTO Users(username, password_hash, role) VALUES(?, ?, 'ADMIN')").run(user, passwordHash);

  return { configured: true };
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

  db.prepare(
    `
      INSERT INTO AuthSessions(token, user_id, expires_at, revoked)
      VALUES(?, ?, ?, 0)
    `
  ).run(token, userId, expiresAt);

  return { token, expiresAt };
}

function login({ username, password }) {
  const user = String(username || "").trim();
  const pass = String(password || "");

  if (!user || !pass) {
    throw new Error("Username and password are required");
  }

  const account = db.prepare("SELECT id, username, password_hash AS passwordHash, role FROM Users WHERE username = ?").get(user);
  if (!account) {
    throw new Error("Invalid credentials");
  }

  const matched = bcrypt.compareSync(pass, account.passwordHash);
  if (!matched) {
    throw new Error("Invalid credentials");
  }

  const session = createSession(account.id);
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: account.id,
      username: account.username,
      role: account.role
    }
  };
}

function getSession({ token }) {
  const sessionToken = String(token || "").trim();
  if (!sessionToken) {
    throw new Error("Session token is required");
  }

  const row = db
    .prepare(
      `
      SELECT
        s.token,
        s.expires_at AS expiresAt,
        s.revoked,
        u.id AS userId,
        u.username,
        u.role
      FROM AuthSessions s
      INNER JOIN Users u ON u.id = s.user_id
      WHERE s.token = ?
      `
    )
    .get(sessionToken);

  if (!row || Number(row.revoked) === 1) {
    throw new Error("Session not found");
  }

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw new Error("Session expired");
  }

  return {
    token: row.token,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      username: row.username,
      role: row.role
    }
  };
}

function requireAuth(payload) {
  const token = payload?.authToken;
  return getSession({ token });
}

function requireRole(payload, allowedRoles = [USER_ROLE.ADMIN]) {
  const session = requireAuth(payload);
  const role = String(session?.user?.role || "").toUpperCase();
  const required = Array.isArray(allowedRoles) && allowedRoles.length ? allowedRoles : [USER_ROLE.ADMIN];

  const allowed = required.some((candidate) => {
    const normalizedCandidate = String(candidate || "").toUpperCase();
    return Number(ROLE_RANK[role] || 0) >= Number(ROLE_RANK[normalizedCandidate] || 0);
  });

  if (!allowed) {
    throw new Error("You do not have permission for this action");
  }

  return session;
}

function logout({ token }) {
  const sessionToken = String(token || "").trim();
  if (!sessionToken) {
    return { loggedOut: true };
  }

  db.prepare("UPDATE AuthSessions SET revoked = 1 WHERE token = ?").run(sessionToken);
  return { loggedOut: true };
}

module.exports = {
  USER_ROLE,
  isConfigured,
  createInitialAdmin,
  login,
  getSession,
  requireAuth,
  requireRole,
  logout
};
