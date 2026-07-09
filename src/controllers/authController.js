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
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_MESSAGE = "If an account exists for this email, an OTP has been sent. Verify it within 5 minutes.";
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_THRESHOLD = 6;
const loginFailureBuckets = new Map();

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createDeliveryHttpError(error, fallbackMessage) {
  const deliveryError = createHttpError(error.userMessage || fallbackMessage, error.statusCode || 502);
  deliveryError.code = error.code || "SMTP_DELIVERY_FAILED";
  deliveryError.deliveryStatus = error.deliveryStatus || "not_sent";
  deliveryError.retryable = error.retryable !== false;
  return deliveryError;
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

function maskEmail(email) {
  const value = String(email || "").trim();
  const [name, domain] = value.split("@");
  if (!name || !domain) {
    return value ? "***" : "";
  }
  return `${name.slice(0, 2)}***@${domain}`;
}

function buildOtpDeliveryMeta(email, emailResult = null) {
  return {
    recipient: maskEmail(email),
    acceptedCount: Array.isArray(emailResult?.accepted) ? emailResult.accepted.length : 0,
    rejectedCount: Array.isArray(emailResult?.rejected) ? emailResult.rejected.length : 0
  };
}

function logAuthOtpEvent(event, payload = {}) {
  console.log(
    JSON.stringify({
      event,
      email: maskEmail(payload.email),
      role: payload.role || undefined,
      reason: payload.reason || undefined,
      accepted: Number.isFinite(payload.accepted) ? payload.accepted : undefined,
      code: payload.code || undefined
    })
  );
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

  const now = Date.now();
  const windowExpiresAt = bucket.windowExpiresAt || bucket.lockUntil || 0;
  if (now > windowExpiresAt) {
    loginFailureBuckets.delete(key);
    return;
  }

  if (bucket.count >= LOGIN_LOCK_THRESHOLD && bucket.lockUntil && now < bucket.lockUntil) {
    throw createHttpError("Too many failed login attempts. Please wait a few minutes and try again.", 429);
  }
}

function recordLoginFailure(req, email) {
  const key = getLoginAttemptKey(req, email);
  const now = Date.now();
  const bucket = loginFailureBuckets.get(key);
  const windowExpiresAt = bucket?.windowExpiresAt || bucket?.lockUntil || 0;

  if (!bucket || now > windowExpiresAt) {
    loginFailureBuckets.set(key, {
      count: 1,
      windowExpiresAt: now + LOGIN_LOCK_WINDOW_MS,
      lockUntil: 0
    });
    return;
  }

  bucket.count += 1;
  if (bucket.count >= LOGIN_LOCK_THRESHOLD) {
    bucket.lockUntil = now + LOGIN_LOCK_WINDOW_MS;
    bucket.windowExpiresAt = bucket.lockUntil;
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

    logAuthOtpEvent("auth_registration_otp_send_attempt", { email, role });
    let emailResult;
    try {
      emailResult = await sendRegistrationOtpEmail({
        email,
        otp,
        username
      });
    } catch (error) {
      await RegistrationOtp.deleteOne({ email, role }).catch(() => {});
      logAuthOtpEvent("auth_registration_otp_send_failed", { email, role, code: error.code });
      throw createDeliveryHttpError(error, "Email delivery failed. The registration OTP was not sent. Please try again.");
    }

    logAuthOtpEvent("auth_registration_otp_send_accepted", {
      email,
      role,
      accepted: (emailResult.accepted || []).length
    });

    res.json({
      message: `An OTP has been sent to ${email}. Enter it to complete registration.`,
      deliveryStatus: "sent",
      sent: true,
      ...buildOtpDeliveryMeta(email, emailResult),
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
      logAuthOtpEvent("auth_password_reset_otp_skipped", {
        email,
        reason: user?.disabledAt ? "disabled" : "not_registered"
      });
      return res.json({
        message: PASSWORD_RESET_MESSAGE,
        deliveryStatus: "skipped",
        sent: false,
        recipient: maskEmail(email),
        acceptedCount: 0,
        rejectedCount: 0,
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

    logAuthOtpEvent("auth_password_reset_otp_send_attempt", { email });
    let emailResult;
    try {
      emailResult = await sendPasswordResetOtpEmail({
        email,
        otp
      });
    } catch (error) {
      await PasswordResetOtp.deleteOne({ email }).catch(() => {});
      logAuthOtpEvent("auth_password_reset_otp_send_failed", { email, code: error.code });
      throw createDeliveryHttpError(error, "Email delivery failed. The password reset OTP was not sent. Please try again.");
    }

    logAuthOtpEvent("auth_password_reset_otp_send_accepted", {
      email,
      accepted: (emailResult.accepted || []).length
    });

    res.json({
      message: PASSWORD_RESET_MESSAGE,
      deliveryStatus: "sent",
      sent: true,
      ...buildOtpDeliveryMeta(email, emailResult),
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
