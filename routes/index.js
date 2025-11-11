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

// esto es el carrusel de peliculas populares en el index
router.get('/api/popular-movies', async (req, res) => {
    try {
        const response = await db.query(`
            SELECT movie_id, title, release_date 
            FROM movie 
            WHERE release_date IS NOT NULL
            ORDER BY popularity DESC 
            LIMIT 10
        `);
        
        // Obtener posters para cada película
        const moviesWithPosters = await Promise.all(
            response.rows.map(async (movie) => {
                const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
                const posterUrl = await getMoviePoster(movie.title, year);
                return {
                    movie_id: movie.movie_id,
                    title: movie.title,
                    poster_url: posterUrl || '/imgs/poster.jpg'
                };
            })
        );
        
        res.json(moviesWithPosters);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener películas' });
    }
});

module.exports = router;