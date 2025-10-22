const express = require('express');
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

router.get('/register', (req, res) => {
    res.render('register');
})

router.post('/register', async (req, res) => {
    const { name, email, username, password } = req.body;
    try {
        const existingUser = await db.query(
            'SELECT * FROM "user" WHERE name = $1 OR email = $2 OR username = $3',
            [name, email, username]
        );
        if (existingUser.rows.length > 0) {
            return res.status(400).send('El usuario, email o nombre de usuario ya existe.');
        }
        await db.query(
            'INSERT INTO "user" (name, email, username, hpassword) VALUES ($1, $2, $3, $4)',
            [name, email, username, await sha256(password)]
        );
        res.status(201).send('Usuario registrado exitosamente.');
    }
    catch (err) {
        console.error(err);
        res.status(500).send('Error al registrar el usuario.');
    }
});

module.exports = router;