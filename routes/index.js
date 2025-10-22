const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
    try{
        const response = await db.query(`select movie.*, popularity from movie order by popularity desc limit 8`);
        res.render('index', {movies: response.rows});
    } catch(error) {
        console.log(error)
        res.render('index', {movies:[]})
    }
});

module.exports = router;