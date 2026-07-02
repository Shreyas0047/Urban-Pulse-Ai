const env = require("../config/env");
const { rolePermissions } = require("../config/roles");
const { issueRoleToken, hashPassword, verifyPassword, hashOneTimeCode, verifyOneTimeCode } = require("../utils/auth");
const User = require("../models/User");
const RegistrationOtp = require("../models/RegistrationOtp");
const PasswordResetOtp = require("../models/PasswordResetOtp");
const { sendPasswordResetOtpEmail, sendRegistrationOtpEmail } = require("../services/emailService");
const crypto = require("crypto");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const OTP_TTL_MS = 90 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_MESSAGE = "If an account exists for this email, an OTP has been sent. Verify it within 90 seconds.";
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_THRESHOLD = 6;
const loginFailureBuckets = new Map();

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeValue(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeValue(value).toLowerCase();
}

function validateRole(role) {
  if (!rolePermissions[role]) {
    throw createHttpError("Invalid role selected.", 400);
  }
}

function validatePassword(password) {
  if (typeof password !== "string") {
    throw createHttpError("Password is required.", 400);
  }

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw createHttpError(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`, 400);
  }
}

function validateEmail(email) {
  if (!EMAIL_PATTERN.test(email)) {
    throw createHttpError("Enter a valid email address.", 400);
  }
}

function buildUsernameFromEmail(email) {
  return normalizeEmail(email);
}

function getLoginAttemptKey(req, email) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || "unknown";
  return `${ip}:${email}`;
}

function assertLoginNotLocked(req, email) {
  const key = getLoginAttemptKey(req, email);
  const bucket = loginFailureBuckets.get(key);

  if (!bucket) {
    return;
  }

  if (Date.now() > bucket.lockUntil) {
    loginFailureBuckets.delete(key);
    return;
  }

  throw createHttpError("Too many failed login attempts. Please wait a few minutes and try again.", 429);
}

function recordLoginFailure(req, email) {
  const key = getLoginAttemptKey(req, email);
  const now = Date.now();
  const bucket = loginFailureBuckets.get(key);

  if (!bucket || now > bucket.lockUntil) {
    loginFailureBuckets.set(key, { count: 1, lockUntil: now + LOGIN_LOCK_WINDOW_MS });
    return;
  }

  bucket.count += 1;
  if (bucket.count >= LOGIN_LOCK_THRESHOLD) {
    bucket.lockUntil = now + LOGIN_LOCK_WINDOW_MS;
  }
}

function clearLoginFailures(req, email) {
  loginFailureBuckets.delete(getLoginAttemptKey(req, email));
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function formatAuthError(error) {
  if (error?.code === 11000) {
    if (error.keyPattern?.email || error.keyValue?.email || String(error.message || "").includes("email_1")) {
      return createHttpError("Email is already registered.", 409);
    }
  }

  return error;
}

function buildAuthResponse(user) {
  const token = issueRoleToken(user.role, user.username, user._id);
  return {
    token,
    role: user.role,
    userId: String(user._id),
    username: user.username,
    permissions: rolePermissions[user.role],
    expiresInSeconds: env.tokenTtlSeconds
  };
}

async function getRoles(_req, res) {
  res.json({
    roles: Object.keys(rolePermissions),
    permissions: rolePermissions
  });
}

async function issueToken(req, res, next) {
  try {
    if (!env.allowRoleTokenIssue) {
      throw createHttpError("Direct token issuing is disabled for security.", 403);
    }

    const role = normalizeValue(req.body.role);
    const email = normalizeEmail(req.body.email);
    validateRole(role);
    validateEmail(email);

    res.json({
      token: issueRoleToken(role, buildUsernameFromEmail(email)),
      role,
      userId: "",
      username: buildUsernameFromEmail(email),
      permissions: rolePermissions[role],
      expiresInSeconds: env.tokenTtlSeconds
    });
  } catch (error) {
    next(formatAuthError(error));
  }
}

async function register(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const role = normalizeValue(req.body.role);
    const otp = normalizeValue(req.body.otp);
    const username = buildUsernameFromEmail(email);

    if (!email || !password || !role || !otp) {
      throw createHttpError("Email, password, role, and OTP are required.", 400);
    }

    validateRole(role);
    validateEmail(email);
    validatePassword(password);

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw createHttpError("Email is already registered.", 409);
    }

    const pendingRegistration = await RegistrationOtp.findOne({ email, role });
    if (!pendingRegistration) {
      throw createHttpError("Request an OTP before completing registration.", 400);
    }

    if (pendingRegistration.expiresAt.getTime() < Date.now()) {
      await RegistrationOtp.deleteOne({ _id: pendingRegistration._id });
      throw createHttpError("The OTP has expired. Request a new OTP and try again.", 400);
    }

    if (!verifyPassword(password, pendingRegistration.passwordHash)) {
      throw createHttpError("The password does not match the one used when requesting the OTP.", 400);
    }

    if (!verifyOneTimeCode(otp, pendingRegistration.otpHash)) {
      pendingRegistration.attempts += 1;
      if (pendingRegistration.attempts >= OTP_MAX_ATTEMPTS) {
        await RegistrationOtp.deleteOne({ _id: pendingRegistration._id });
        throw createHttpError("Too many incorrect OTP attempts. Request a new OTP and try again.", 429);
      }

      await pendingRegistration.save();
      throw createHttpError("Incorrect OTP. Check the email and try again.", 400);
    }

    const user = await User.create({
      username,
      email,
      passwordHash: pendingRegistration.passwordHash,
      role
    });
    await RegistrationOtp.deleteOne({ _id: pendingRegistration._id });

    res.json(buildAuthResponse(user));
  } catch (error) {
    next(formatAuthError(error));
  }
}

async function requestRegistrationOtp(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const role = normalizeValue(req.body.role);
    const username = buildUsernameFromEmail(email);

    if (!email || !password || !role) {
      throw createHttpError("Email, password, and role are required.", 400);
    }

    validateRole(role);
    validateEmail(email);
    validatePassword(password);

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw createHttpError("Email is already registered.", 409);
    }

    const otp = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await RegistrationOtp.findOneAndUpdate(
      { email, role },
      {
        username,
        email,
        role,
        passwordHash: hashPassword(password),
        otpHash: hashOneTimeCode(otp),
        attempts: 0,
        expiresAt
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendRegistrationOtpEmail({
      email,
      otp,
      username
    });

    res.json({
      message: `An OTP has been sent to ${email}. Enter it to complete registration.`,
      expiresInSeconds: OTP_TTL_MS / 1000
    });
  } catch (error) {
    next(formatAuthError(error));
  }
}

async function requestPasswordResetOtp(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      throw createHttpError("Email is required.", 400);
    }

    validateEmail(email);

    const user = await User.findOne({ email });
    if (!user || user.disabledAt) {
      await PasswordResetOtp.deleteOne({ email }).catch(() => {});
      return res.json({
        message: PASSWORD_RESET_MESSAGE,
        expiresInSeconds: OTP_TTL_MS / 1000
      });
    }

    const otp = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await PasswordResetOtp.findOneAndUpdate(
      { email },
      {
        email,
        otpHash: hashOneTimeCode(otp),
        attempts: 0,
        expiresAt
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendPasswordResetOtpEmail({
      email,
      otp
    });

    res.json({
      message: PASSWORD_RESET_MESSAGE,
      expiresInSeconds: OTP_TTL_MS / 1000
    });
  } catch (error) {
    next(formatAuthError(error));
  }
}

async function resetPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = normalizeValue(req.body.otp);
    const password = req.body.password;

    if (!email || !otp || !password) {
      throw createHttpError("Email, OTP, and new password are required.", 400);
    }

    validateEmail(email);
    validatePassword(password);

    const pendingReset = await PasswordResetOtp.findOne({ email });
    if (!pendingReset) {
      throw createHttpError("Request a password reset OTP before continuing.", 400);
    }

    if (pendingReset.expiresAt.getTime() < Date.now()) {
      await PasswordResetOtp.deleteOne({ _id: pendingReset._id });
      throw createHttpError("The OTP has expired. Request a new OTP and try again.", 400);
    }

    if (!verifyOneTimeCode(otp, pendingReset.otpHash)) {
      pendingReset.attempts += 1;
      if (pendingReset.attempts >= OTP_MAX_ATTEMPTS) {
        await PasswordResetOtp.deleteOne({ _id: pendingReset._id });
        throw createHttpError("Too many incorrect OTP attempts. Request a new OTP and try again.", 429);
      }

      await pendingReset.save();
      throw createHttpError("Incorrect OTP. Check the email and try again.", 400);
    }

    const user = await User.findOne({ email });
    if (!user || user.disabledAt) {
      await PasswordResetOtp.deleteOne({ _id: pendingReset._id });
      throw createHttpError("Unable to reset this account password.", 400);
    }

    if (verifyPassword(password, user.passwordHash)) {
      throw createHttpError("Choose a new password that is different from the current password.", 400);
    }

    user.passwordHash = hashPassword(password);
    await user.save();
    await PasswordResetOtp.deleteOne({ _id: pendingReset._id });
    clearLoginFailures(req, email);

    res.json({
      message: "Password reset successful. Login with your new password."
    });
  } catch (error) {
    next(formatAuthError(error));
  }
}

async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const role = normalizeValue(req.body.role);

    if (!email || !password || !role) {
      throw createHttpError("Email, password, and role are required.", 400);
    }

    validateRole(role);
    validateEmail(email);
    validatePassword(password);
    assertLoginNotLocked(req, email);

    const user = await User.findOne({
      role,
      email
    });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      recordLoginFailure(req, email);
      throw createHttpError("Invalid email, password, or role.", 401);
    }
    if (user.disabledAt) {
      throw createHttpError("This account is disabled. Contact an administrator.", 403);
    }
    clearLoginFailures(req, email);
    user.lastLoginAt = new Date();
    await user.save();

    res.json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRoles,
  issueToken,
  requestRegistrationOtp,
  requestPasswordResetOtp,
  resetPassword,
  register,
  login
};
