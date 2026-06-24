const User = require("../models/User");

const ALLOWED_ROLES = ["Admin", "Citizen"];

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function serializeUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email || "",
    role: user.role,
    disabledAt: user.disabledAt || null,
    disabledBy: user.disabledBy || "",
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt
  };
}

async function updateUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw createHttpError("User not found.", 404);
    }
    const updatingCurrentUser =
      (req.auth.userId && String(user._id) === String(req.auth.userId)) ||
      user.username === req.auth.username;

    if (req.body.role !== undefined) {
      const nextRole = String(req.body.role || "").trim();
      if (!ALLOWED_ROLES.includes(nextRole)) {
        throw createHttpError("Invalid role selected.", 400);
      }
      if (updatingCurrentUser && nextRole !== user.role) {
        throw createHttpError("You cannot change your own active admin role.", 400);
      }
      user.role = nextRole;
    }

    if (req.body.disabled !== undefined) {
      const disabled = Boolean(req.body.disabled);
      if (disabled && updatingCurrentUser) {
        throw createHttpError("You cannot disable your own active admin account.", 400);
      }
      user.disabledAt = disabled ? new Date() : null;
      user.disabledBy = disabled ? req.auth.username : "";
    }

    await user.save();

    res.json({
      message: `${user.username} updated successfully.`,
      user: serializeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = 404;
      throw error;
    }

    await User.deleteOne({ _id: user._id });

    res.json({
      message: `${user.role} account ${user.username} deleted successfully.`,
      deletedUser: {
        id: user._id,
        username: user.username,
        email: user.email || "",
        role: user.role,
        disabledAt: user.disabledAt || null
      },
      deletedCurrentSession: user.username === req.auth.username && user.role === req.auth.role
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  updateUser,
  deleteUser
};
