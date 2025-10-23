const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const token = req.cookies && req.cookies.access_token;
  if (!token) return res.status(401).json({ ok: false, message: 'No token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ ok: false, message: 'Token inválido' });
    req.user = payload;
    next();
  });
}

module.exports = { authenticate };