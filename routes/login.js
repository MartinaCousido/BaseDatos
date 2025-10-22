const express = require("express");
const router = express.Router();
require("dotenv").config();
const { Pool } = require("pg");
const crypto = require('crypto');

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  options: `-c search_path=users,public`,
});

async function sha256(message) {
  // Use Node's crypto module to compute SHA-256 and return hex string
  return crypto.createHash('sha256').update(String(message)).digest('hex');
}

router.get("/login", (req, res) => {
  res.render("login");
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await sha256(password);
  try {
    const response = await db.query(
      "SELECT * FROM \"user\" WHERE (email = $1 OR username = $1) AND hpassword = $2",
      [username, hashedPassword]
    );
  if (response.rows.length > 0) {
    // Return JSON so clients using fetch/AJAX don't get a full-page navigation
    return res.status(200).send({ ok: true, message: "Login exitoso", data: response.rows[0] });
  } else {
    return res.status(401).json({ ok: false, message: "Credenciales inválidas" });
  }
  } catch (error) {
    console.error("Error al realizar la consulta:", error);
    return res.status(500).send("Error interno del servidor");
  }
});

router.get("/logout", (req, res) => {
    res.render("logout");
});

module.exports = router;
