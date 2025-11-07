const { Pool } = require('pg');
require('dotenv').config(); 

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // include 'users' schema so shared pool can access user tables
  options: `-c search_path=users,movies,public`,
});

module.exports = db;