require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3500;

app.use(express.static('views'));
app.use(express.static('public'));

const db = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,    
    options: `-c search_path=movies,public`,
});

app.set('view engine', 'ejs');

// --- FUNCIONES QUE TRAEN TODOS LOS RESULTADOS (SIN PAGINACIÓN) ---

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
app.get('/buscar', async (req, res) => {
    const searchTerm = req.query.q || '';

    try {
        // Obtenemos las listas completas de resultados
        const moviesData = await getMoviesForSearch(searchTerm);
        const actorsData = await getPeopleForSearch(searchTerm, 'actor');
        const directorsData = await getPeopleForSearch(searchTerm, 'director');

        // Las enviamos a la plantilla
        res.render('resultado', { 
            toSearch: searchTerm,
            movies: moviesData,
            actors: actorsData,
            directors: directorsData,
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Error en la búsqueda.');
    }
});

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para la página de datos de una película particular (PostgreSQL)
// Ruta para la página de datos de una película particular (PostgreSQL)
app.get('/pelicula/:id', async (req, res) => {
    const movieId = req.params.id;

    const query = `
    SELECT
      movie.*,
      actor.person_name as actor_name,
      actor.person_id as actor_id,
      crew_member.person_name as crew_member_name,
      crew_member.person_id as crew_member_id,
      movie_cast.character_name,
      movie_cast.cast_order,
      department.department_name,
      movie_crew.job,
      country.country_name,
      genre.genre_name,
      language.language_code,
      language.language_name,
      language_role.language_role,
      production_company.company_name
    FROM movie
    LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
    LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    LEFT JOIN department ON movie_crew.department_id = department.department_id
    LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id
    LEFT JOIN production_country ON movie.movie_id = production_country.movie_id
    LEFT JOIN country ON production_country.country_id = country.country_id
    LEFT JOIN movie_genres ON movie.movie_id = movie_genres.movie_id
    LEFT JOIN genre ON movie_genres.genre_id = genre.genre_id
    LEFT JOIN movie_languages ON movie.movie_id = movie_languages.movie_id
    LEFT JOIN language ON movie_languages.language_id = language.language_id
    LEFT JOIN language_role ON movie_languages.language_role_id = language_role.role_id
    LEFT JOIN movie_company ON movie.movie_id = movie_company.movie_id
    LEFT JOIN production_company ON movie_company.company_id = production_company.company_id
    WHERE movie.movie_id = $1
  `;

    try {
        const result = await db.query(query, [movieId]);
        const rows = result.rows;

        if (rows.length === 0) {
            return res.status(404).send('Película no encontrada.');
        }

        const movieData = {
            tagline: rows[0].tagline,
            id: rows[0].id,
            title: rows[0].title,
            release_date: rows[0].release_date,
            overview: rows[0].overview,
            directors: [],
            writers: [],
            cast: [],
            crew: [],
            countries: [],
            genres: [],
            originalLanguage: null,
            productionCompanies: []
        };

        // Procesar directores
        rows.forEach((row) => {
            if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                const isDuplicate = movieData.directors.some((crew_member) => crew_member.crew_member_id === row.crew_member_id);
                if (!isDuplicate && row.department_name === 'Directing' && row.job === 'Director') {
                    movieData.directors.push({
                        crew_member_id: row.crew_member_id,
                        crew_member_name: row.crew_member_name,
                        department_name: row.department_name,
                        job: row.job,
                    });
                }
            }
        });

        // Procesar escritores
        rows.forEach((row) => {
            if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                const isDuplicate = movieData.writers.some((crew_member) => crew_member.crew_member_id === row.crew_member_id);
                if (!isDuplicate && row.department_name === 'Writing' && (row.job === 'Writer' || row.job === 'Screenplay')) {
                    movieData.writers.push({
                        crew_member_id: row.crew_member_id,
                        crew_member_name: row.crew_member_name,
                        department_name: row.department_name,
                        job: row.job,
                    });
                }
            }
        });

        // Procesar elenco
        rows.forEach((row) => {
            if (row.actor_id && row.actor_name && row.character_name) {
                const isDuplicate = movieData.cast.some((actor) => actor.actor_id === row.actor_id);
                if (!isDuplicate) {
                    movieData.cast.push({
                        actor_id: row.actor_id,
                        actor_name: row.actor_name,
                        character_name: row.character_name,
                        cast_order: row.cast_order,
                    });
                }
            }
        });

        // Procesar crew
        rows.forEach((row) => {
            if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                const isDuplicate = movieData.crew.some((crew_member) => crew_member.crew_member_id === row.crew_member_id);
                if (!isDuplicate) {
                    if (row.department_name !== 'Directing' && row.department_name !== 'Writing') {
                        movieData.crew.push({
                            crew_member_id: row.crew_member_id,
                            crew_member_name: row.crew_member_name,
                            department_name: row.department_name,
                            job: row.job,
                        });
                    }
                }
            }
        });

        // Procesar países de producción
        rows.forEach((row) => {
            if (row.country_name && !movieData.countries.includes(row.country_name)) {
                movieData.countries.push(row.country_name);
            }
        });

        // Procesar géneros
        rows.forEach((row) => {
            if (row.genre_name && !movieData.genres.includes(row.genre_name)) {
                movieData.genres.push(row.genre_name);
            }
        });

        // Procesar idioma original (solo el que tenga el rol "Original")
        rows.forEach((row) => {
            if (row.language_name && row.language_role && row.language_role.toLowerCase().includes('original') && !movieData.originalLanguage) {
                movieData.originalLanguage = row.language_name;
            }
        });

        // Procesar compañías de producción
        rows.forEach((row) => {
            if (row.company_name && !movieData.productionCompanies.includes(row.company_name)) {
                movieData.productionCompanies.push(row.company_name);
            }
        });

        res.render('pelicula', { movie: movieData });

    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar los datos de la película.');
    }
});

// ACTOR
app.get('/actor/:id', async (req, res) => {
    const actorId = req.params.id;
    try {
        // Consulta: obtener información completa del actor
        const actorResult = await db.query(`
            SELECT p.person_name
            FROM person p
            WHERE p.person_id = $1
        `, [actorId]);
        
        // Consulta: obtener películas con personajes y género del personaje
        const moviesResult = await db.query(`
            SELECT m.movie_id, m.title, m.release_date, mc.character_name, g.gender
            FROM movie m
            JOIN movie_cast mc ON m.movie_id = mc.movie_id
            LEFT JOIN gender g ON mc.gender_id = g.gender_id
            WHERE mc.person_id = $1
            ORDER BY m.release_date DESC
        `, [actorId]);
        
        if (actorResult.rows.length === 0) {
            return res.status(404).send('Actor no encontrado.');
        }

        const actorName = actorResult.rows[0].person_name;
        const movies = moviesResult.rows;

        // Obtener el género más común del actor basado en sus personajes
        const genders = movies.map(m => m.gender).filter(g => g);
        const genderCount = {};
        genders.forEach(g => {
            genderCount[g] = (genderCount[g] || 0) + 1;
        });
        const mostCommonGender = Object.keys(genderCount).length > 0 
            ? Object.keys(genderCount).reduce((a, b) => genderCount[a] > genderCount[b] ? a : b)
            : 'No especificado';

        // Traducir género
        const genderTranslation = {
            'Male': 'Masculino',
            'Female': 'Femenino',
            'Non-binary': 'No binario'
        };
        const translatedGender = genderTranslation[mostCommonGender] || mostCommonGender;

        res.render('actor', { 
            actorName, 
            actorGender: translatedGender, 
            movies 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener información del actor');
    }
});

// DIRECTOR
app.get('/director/:id', async (req, res) => {
    const directorId = req.params.id;
    try {
        // Consulta: obtener nombre del director
        const directorResult = await db.query('SELECT person_name FROM person WHERE person_id = $1', [directorId]);
        
        // Consulta: obtener películas que dirigió
        const moviesResult = await db.query(`
            SELECT m.movie_id, m.title, m.release_date
            FROM movie_crew as mc
            LEFT JOIN movie as m ON m.movie_id = mc.movie_id
            WHERE job ILIKE '%director%' AND mc.person_id = $1
            ORDER BY m.release_date DESC
        `, [directorId]);

        if (directorResult.rows.length === 0) {
            return res.status(404).send('Director no encontrado.');
        }

        const directorName = directorResult.rows[0].person_name;
        const movies = moviesResult.rows;

        res.render('director', { directorName, movies });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener información del director');
    }
});

app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
