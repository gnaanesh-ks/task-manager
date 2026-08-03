/**
 * Lightweight request-body validators for auth routes.
 * Avoids pulling in a full schema-validation library to keep the
 * service dependency footprint small, while still providing
 * meaningful, field-level error messages to the client.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignup(req, res, next) {
  const { username, email, password } = req.body || {};
  const errors = [];

  if (!username || typeof username !== "string" || username.trim().length < 3) {
    errors.push("Username must be at least 3 characters long");
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    errors.push("A valid email address is required");
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    errors.push("Password must be at least 6 characters long");
  }

  if (errors.length) {
    return res.status(400).json({ message: errors.join(", ") });
  }
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body || {};
  const errors = [];

  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    errors.push("A valid email address is required");
  }
  if (!password || typeof password !== "string") {
    errors.push("Password is required");
  }

  if (errors.length) {
    return res.status(400).json({ message: errors.join(", ") });
  }
  next();
}

module.exports = { validateSignup, validateLogin };
