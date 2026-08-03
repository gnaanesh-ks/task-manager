const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifies the JWT issued by the auth-service.
 * Both services share the same JWT_SECRET (injected via Kubernetes Secret),
 * allowing task-service to verify tokens locally without a network call
 * back to auth-service on every request.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token has expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = { requireAuth };
