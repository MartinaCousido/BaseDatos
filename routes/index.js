const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getMoviePoster } = require('../tmdb');

router.get('/', async (req, res) => {
    try {
        const response = await db.query(`
            SELECT movie.*, popularity 
            FROM movie 
            WHERE release_date IS NOT NULL
            ORDER BY popularity DESC 
            LIMIT 8
        `);
        
        // tengo que obtener los posters de las pelis luego de renderizar
        res.render('index', { movies: response.rows});
    } catch(error) {
        console.log('ERROR:', error);
        res.render('index', { movies: [] });
    }
});

module.exports = router;