const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getMoviePoster, getPersonPhoto } = require('../tmdb');

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

// Función helper para agregar posters a las películas
async function addPostersToMovies(movies) {
    return await Promise.all(
        movies.map(async (movie) => {
            const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
            const posterUrl = await getMoviePoster(movie.title, year);
            return {
                ...movie,
                poster_url: posterUrl || '/imgs/poster.png'
            };
        })
    );
}

async function addPhotosToPersons(persons) {
    return await Promise.all(
        persons.map(async (person) => {
            const photoUrl = await getPersonPhoto(person.person_name);
            return {
                ...person,
                photo_url: photoUrl || '/imgs/Tom_Hanks.png'
            };
        })
    );
}
// --- RUTA DE BÚSQUEDA ---
router.get('/buscar', async (req, res) => {
    const searchTerm = req.query.q || '';

    try {
        const moviesData = await getMoviesForSearch(searchTerm);
        const actorsData = await getPeopleForSearch(searchTerm, 'actor');
        const directorsData = await getPeopleForSearch(searchTerm, 'director');

        // Agregar posters a las películas
        const moviesWithPosters = await addPostersToMovies(moviesData);
        const actorsWithPhotos = await addPhotosToPersons(actorsData);
        const directorsWithPhotos = await addPhotosToPersons(directorsData);

        res.render('resultado', { 
            toSearch: searchTerm,
            genre: null,
            movies: moviesWithPosters,
            actors: actorsWithPhotos,
            directors: directorsWithPhotos,
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Error en la búsqueda.');
    }
});

// --- BÚSQUEDA POR GÉNERO ---
router.get('/buscar/:genre', async (req, res) => {
    const genreToSearch = req.params.genre;
    try {
        const response = await getMoviesByGenre(genreToSearch);
        
        // Agregar posters a las películas
        const moviesWithPosters = await addPostersToMovies(response);
        
        res.render('resultado', {
            toSearch: null,
            genre: genreToSearch,
            movies: moviesWithPosters,
            actors: [],
            directors: []
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error en la búsqueda.');
    }
});

module.exports = router;