const express = require('express');
const router = express.Router();
require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require('bcryptjs');

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  options: `-c search_path=users,public`,
});

// helper: hash password with bcrypt
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(String(password), salt);
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
            return res.status(400).json({ ok: false, message: 'El usuario, email o nombre de usuario ya existe.' });
        }
        const hashed = await hashPassword(password);
        await db.query(
            'INSERT INTO "user" (name, email, username, hpassword) VALUES ($1, $2, $3, $4)',
            [name, email, username, hashed]
        );
        res.status(201).json({ ok: true, message: 'Usuario registrado exitosamente.' });
    }
    catch (err) {
        console.error(err);
        res.status(500).send('Error al registrar el usuario.');
    }
});

module.exports = router;