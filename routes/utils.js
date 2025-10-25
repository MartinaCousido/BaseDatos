const express = require('express');
const router = express.Router();
const db = require('../config/db');

async function getAllGenres() {
    try {
        const result = await db.query(`
            SELECT DISTINCT genre_name 
            FROM genre 
            ORDER BY genre_name
        `);
        return result.rows; // [{ genre_name: "Action" }, ...]
    } catch (error) {
        console.error("Error al cargar géneros:", error);
        return [];
    }
}

async function getAllLanguages() {
    try {
        const result = await db.query(`
            SELECT DISTINCT language_name 
            FROM language 
            JOIN movie_languages ON language.language_id = movie_languages.language_id
            ORDER BY language_name
        `);
        return result.rows; // [{ language_name: "English" }, ...]
    } catch (error) {
        console.error("Error al cargar idiomas:", error);
        return [];
    }
}


router.get('/navbar-data', async (req, res) => {
    try {
        const genres = await getAllGenres();
        const countries = await getAllCountries(); 
        const idiomas = await getAllLanguages();

        res.json({
            genres,
            countries,
            idiomas
        });
    } catch (error) {
        console.error("Error al cargar navbar:", error);
        res.status(500).json({
            genres: [],
            countries: [],
            idiomas: [],
            error: "Error al obtener datos del navbar"
        });
    }
});

async function getAllCountries() {
    try {
        const result = await db.query(`
            SELECT DISTINCT country_name 
            FROM country 
            JOIN production_country ON country.country_id = production_country.country_id
            ORDER BY country_name
        `);
        return result.rows; 
    } catch (error) {
        console.error("Error al cargar países:", error);
        return [];
    }
}

async function getMoviesByGenre(genre) {
    try {
        const response = await db.query(
            `
            SELECT *
            FROM movie
            WHERE movie_id IN (
                SELECT movie_id
                FROM movie_genres
                WHERE genre_id = (
                    SELECT genre_id
                    FROM genre
                    WHERE genre_name ILIKE $1
                    LIMIT 1
                )
            );
            `, [`${genre}`]
        );

        return response.rows;
    } catch(error) {
        console.log(error);
        return [];
    }
}

router.get('/buscar/genero/:genre', async (req, res) => {
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


router.get('/buscar/pais/:country', async (req, res) => {
    const countryToSearch = req.params.country;
    try {
        const movies = await db.query(`
            SELECT m.*
            FROM movie m
            JOIN production_country pc ON m.movie_id = pc.movie_id
            JOIN country c ON pc.country_id = c.country_id
            WHERE c.country_name ILIKE $1
        `, [countryToSearch]);

        res.render('resultado', {
            toSearch: null,
            genre: null,
            country: countryToSearch,
            movies: movies.rows,
            actors: [],
            directors: []
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error en búsqueda por país.');
    }
});

router.get('/buscar/idioma/:language', async (req, res) => {
    const languageToSearch = req.params.language;
    try {
        const movies = await db.query(`
            SELECT m.*
            FROM movie m
            JOIN movie_languages ml ON m.movie_id = ml.movie_id
            JOIN language l ON ml.language_id = l.language_id
            WHERE l.language_name ILIKE $1
        `, [languageToSearch]);

        res.render('resultado', {
            toSearch: null,
            genre: null,
            country: null,
            language: languageToSearch,  // AÑADIDO
            movies: movies.rows,
            actors: [],
            directors: []
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error en búsqueda por idioma.');
    }
});


module.exports = router;