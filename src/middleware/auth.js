const { verifyToken } = require("../utils/auth");
const User = require("../models/User");
const { rolePermissions } = require("../config/roles");

async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      const error = new Error("Missing bearer token");
      error.statusCode = 401;
      throw error;
    }

    const tokenAuth = verifyToken(authHeader.slice("Bearer ".length));
    if (tokenAuth.userId) {
      const user = await User.findById(tokenAuth.userId, {
        username: 1,
        role: 1,
        disabledAt: 1,
        tokenVersion: 1,
        operationalCityIds: 1
      }).lean();
      if (!user || user.disabledAt) {
        const error = new Error("This session is no longer active. Please login again.");
        error.statusCode = 401;
        throw error;
      }
      if (Number(user.tokenVersion || 0) !== Number(tokenAuth.tokenVersion || 0)) {
        const error = new Error("This session has expired. Please login again.");
        error.statusCode = 401;
        throw error;
      }
      tokenAuth.username = user.username;
      tokenAuth.role = user.role;
      tokenAuth.permissions = rolePermissions[user.role] || [];
      tokenAuth.operationalCityIds = user.role === "Admin" && user.operationalCityIds?.length
        ? user.operationalCityIds.map((cityId) => String(cityId).trim().toLowerCase())
        : user.role === "Admin" ? ["bengaluru"] : [];
    }
    req.auth = tokenAuth;
    next();
  } catch (error) {
    error.statusCode = error.statusCode || 401;
    next(error);
  }
}

function requirePermission(permission) {
  return (req, _res, next) => {
    try {
      if (!req.auth?.permissions?.includes(permission)) {
        const error = new Error("Permission denied");
        error.statusCode = 403;
        throw error;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  authenticate,
  requirePermission
};
