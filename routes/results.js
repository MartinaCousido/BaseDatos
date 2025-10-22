const express = require('express');
const router = express.Router();
const db = require('../config/db');

async function getMoviesByGenre(genre) {
    try {
        const response = await db.query(
            `
            select m.*
            from genre
            join movie_genres as mg on genre.genre_id = mg.genre_id
            join movie as m on mg.movie_id = m.movie_id
            where genre.genre_name ilike $1;
            `, [`${genre}`]
        );

        return response.rows;
    } catch(error) {
        console.log(error);
        return [];
    }
}

async function getMoviesForSearch(toSearch) {
    // Usamos UNION ALL con prioridad, pero sin LIMIT/OFFSET para traer todo
    const query = `
        (SELECT *, 1 as priority FROM movie WHERE title ILIKE $1)
        UNION ALL
        (SELECT *, 2 as priority FROM movie WHERE title ILIKE $2 AND NOT title ILIKE $1)
        UNION ALL
        (SELECT *, 3 as priority FROM movie WHERE (overview ILIKE $3 OR tagline ILIKE $3) AND NOT title ILIKE $1)
        ORDER BY priority, title
    `;
    const values = [`${toSearch}%`, `%${toSearch}%`, `% ${toSearch} %`];
    try {
        const results = await db.query(query, values);
        return results.rows;
    } catch (error) {
        console.log(error);
        return [];
    }
}

async function getPeopleForSearch(toSearch, type = 'actor') {
    const jobFilter = type === 'director' 
        ? `JOIN movie_crew as mc on p.person_id = mc.person_id WHERE job ILIKE '%director%' AND`
        : `JOIN movie_cast as mc on p.person_id = mc.person_id WHERE mc.character_name IS NOT NULL AND`;
    
    const query = `
        SELECT * FROM (
            SELECT DISTINCT person_id, person_name, priority FROM (
                (SELECT p.person_id, p.person_name, 1 as priority FROM person as p ${jobFilter} p.person_name ILIKE $1)
                UNION ALL
                (SELECT p.person_id, p.person_name, 2 as priority FROM person as p ${jobFilter} p.person_name ILIKE $2 AND NOT p.person_name ILIKE $1)
            ) as u
        ) as results 
        ORDER BY priority, person_name
    `;
    const values = [`${toSearch}%`, `%${toSearch}%`];
    try {
        const results = await db.query(query, values);
        return results.rows;
    } catch (error) {
        console.log(error);
        return [];
    }
}

// --- RUTA DE BÚSQUEDA (SIMPLE Y EFICIENTE) ---
router.get('/buscar', async (req, res) => {

    const searchTerm = req.query.q || '';

    try {
        // Obtenemos las listas completas de resultados
        const moviesData = await getMoviesForSearch(searchTerm);
        const actorsData = await getPeopleForSearch(searchTerm, 'actor');
        const directorsData = await getPeopleForSearch(searchTerm, 'director');

        // Las enviamos a la plantilla
        res.render('resultado', { 
            toSearch: searchTerm,
            genre: null,
            movies: moviesData,
            actors: actorsData,
            directors: directorsData,
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Error en la búsqueda.');
    }
});

// --- FUNCIONES QUE TRAEN TODOS LOS RESULTADOS (SIN PAGINACIÓN) ---
router.get('/buscar/:genre', async (req, res) => {
    const genreToSearch = req.params.genre;
    try{
        const response = await getMoviesByGenre(genreToSearch);
        res.render('resultado', {
            toSearch: null,
            genre: genreToSearch,
            movies: response,
            actors: [],
            directors: []
        })
    }catch ( error ) {
        console.log(error);
        res.status(500).send('Error en la busqueda.')
    }
})

module.exports = router;