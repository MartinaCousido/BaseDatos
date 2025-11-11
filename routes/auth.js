// src/middleware/auth.js
const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  try {
    // ejemplo: token en cookie "token" o header Authorization: Bearer <token>
    const raw =
      (req.cookies && req.cookies.token) ||
      (req.headers.authorization && req.headers.authorization.split(" ")[1]);

    if (!raw) return res.status(401).json({ ok: false, error: "missing token" });

    const payload = jwt.verify(raw, process.env.JWT_SECRET || "secret");
    // Esperamos que payload tenga { uid: <user_id de SQL> }
    req.user = { uid: payload.uid };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "invalid token" });
  }
}

module.exports = { authenticate };
