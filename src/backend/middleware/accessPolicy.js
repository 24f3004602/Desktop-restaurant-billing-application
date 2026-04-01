const authService = require("../services/authService");

function authorize(allowedRoles, payload) {
  return authService.requireRole(payload || {}, allowedRoles);
}

function toRoleIpcResponse(allowedRoles, handler, fallbackMessage) {
  return async (_event, payload) => {
    try {
      authorize(allowedRoles, payload);
      const data = await handler(payload || {});
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : fallbackMessage || "Unauthorized"
      };
    }
  };
}

module.exports = {
  authorize,
  toRoleIpcResponse
};
