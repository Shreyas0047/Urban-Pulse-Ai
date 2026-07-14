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

function isSameUser(user, auth) {
  return (
    (auth.userId && String(user._id) === String(auth.userId)) ||
    user.username === auth.username
  );
}

async function hasAnotherActiveAdmin(userId) {
  const count = await User.countDocuments({
    _id: { $ne: userId },
    role: "Admin",
    disabledAt: null
  });
  return count > 0;
}

async function updateUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw createHttpError("User not found.", 404);
    }
    const updatingCurrentUser = isSameUser(user, req.auth);
    let invalidateSessions = false;

    if (req.body.role !== undefined) {
      const nextRole = String(req.body.role || "").trim();
      if (!ALLOWED_ROLES.includes(nextRole)) {
        throw createHttpError("Invalid role selected.", 400);
      }
      if (updatingCurrentUser && nextRole !== user.role) {
        throw createHttpError("You cannot change your own active admin role.", 400);
      }
      if (user.role === "Admin" && nextRole !== "Admin" && user.disabledAt === null) {
        const anotherAdminExists = await hasAnotherActiveAdmin(user._id);
        if (!anotherAdminExists) {
          throw createHttpError("At least one active admin account must remain.", 400);
        }
      }
      invalidateSessions = invalidateSessions || nextRole !== user.role;
      user.role = nextRole;
    }

    if (req.body.disabled !== undefined) {
      const disabled = Boolean(req.body.disabled);
      if (disabled && updatingCurrentUser) {
        throw createHttpError("You cannot disable your own active admin account.", 400);
      }
      if (disabled && user.role === "Admin" && user.disabledAt === null) {
        const anotherAdminExists = await hasAnotherActiveAdmin(user._id);
        if (!anotherAdminExists) {
          throw createHttpError("At least one active admin account must remain.", 400);
        }
      }
      invalidateSessions = invalidateSessions || disabled !== Boolean(user.disabledAt);
      user.disabledAt = disabled ? new Date() : null;
      user.disabledBy = disabled ? req.auth.username : "";
    }

    if (invalidateSessions) {
      user.tokenVersion = Number(user.tokenVersion || 0) + 1;
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
      throw createHttpError("User not found.", 404);
    }

    if (isSameUser(user, req.auth)) {
      throw createHttpError("You cannot delete your own active admin account.", 400);
    }

    if (user.role === "Admin" && user.disabledAt === null) {
      const anotherAdminExists = await hasAnotherActiveAdmin(user._id);
      if (!anotherAdminExists) {
        throw createHttpError("At least one active admin account must remain.", 400);
      }
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
