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
        
        console.log('Películas obtenidas:', response.rows.length);
        
        // Obtener posters para cada película
        const moviesWithPosters = await Promise.all(
            response.rows.map(async (movie) => {
                const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
                console.log(`Buscando poster para: ${movie.title} (${year})`);
                const posterUrl = await getMoviePoster(movie.title, year);
                console.log(`Poster URL: ${posterUrl}`);
                return {
                    ...movie,
                    poster_url: posterUrl || '/imgs/poster.png'
                };
            })
        );
        
        console.log('Películas con posters:', moviesWithPosters.length);
        res.render('index', { movies: moviesWithPosters });
    } catch(error) {
        console.log('ERROR:', error);
        res.render('index', { movies: [] });
    }
});

module.exports = router;