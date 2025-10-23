const express = require("express");
const router = express.Router();
require("dotenv").config();
const { Pool } = require("pg");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  options: `-c search_path=users,public`,
});

// Note: you should create a table to store refresh tokens for revocation, for example:
// CREATE TABLE refresh_tokens (id UUID PRIMARY KEY, user_id INT NOT NULL, expires_at TIMESTAMP NOT NULL);

function createAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function createRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

router.get("/login", (req, res) => {
  res.render("login");
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const response = await db.query(
      'SELECT * FROM "user" WHERE (email = $1 OR username = $1)',
      [username]
    );

    if (response.rows.length === 0) {
      return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });
    }

    const user = response.rows[0];

    // user.hpassword is expected to be a bcrypt hash
    const match = await bcrypt.compare(String(password), user.hpassword);
    if (!match) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    // determine user id field (defensive): common column names
    const userId = user.id ?? user.user_id ?? user.userid ?? user.uid ?? user.client_id ?? user.id_user ?? null;
    if (!userId) {
      console.error('Could not determine user primary id column. User row:', user);
      return res.status(500).json({ ok: false, message: 'Error interno: id de usuario no determinado' });
    }

    // create tokens
    const payload = { uid: userId, username: user.username ?? user.email ?? null };
    const accessToken = createAccessToken(payload);
    const tokenId = uuidv4();
    const refreshToken = createRefreshToken({ uid: userId, tid: tokenId });

    // store refresh token id in DB for revocation
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.query('INSERT INTO refresh_tokens (id, user_id, expires_at) VALUES ($1, $2, $3)', [tokenId, userId, expiresAt]);

    // Send tokens in HttpOnly cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 15 * 60 * 1000
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // Do not send sensitive fields to client
  const publicUser = { id: userId, username: user.username ?? user.email ?? null, email: user.email };
    return res.status(200).json({ ok: true, user: publicUser });
  } catch (error) {
    console.error('Error al realizar la consulta:', error);
    return res.status(500).send('Error interno del servidor');
  }
});

// refresh endpoint
router.post('/auth/refresh', async (req, res) => {
  const token = req.cookies.refresh_token;
  if (!token) return res.status(401).json({ ok: false });
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const { uid, tid } = payload;

    // check DB that token id exists and not expired
    const r = await db.query('SELECT * FROM refresh_tokens WHERE id = $1 AND user_id = $2', [tid, uid]);
    if (r.rows.length === 0) return res.status(401).json({ ok: false });

    // generate new access token
    const accessToken = createAccessToken({ uid, tid });
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 15 * 60 * 1000
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Refresh token error', err);
    return res.status(401).json({ ok: false });
  }
});

// logout: delete refresh token from DB and clear cookies
router.post('/logout', async (req, res) => {
  const token = req.cookies.refresh_token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      const { tid } = payload;
      await db.query('DELETE FROM refresh_tokens WHERE id = $1', [tid]);
    } catch (err) {
      console.log(err);
    }
  }
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  return res.json({ ok: true });
});

router.get("/logout", (req, res) => {
    res.render("logout");
});

module.exports = router;
