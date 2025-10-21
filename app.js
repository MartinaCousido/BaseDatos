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

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');


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
app.get('/buscar/:genre', async (req, res) => {
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
        m.movie_id AS id,
        m.title,
        m.tagline,
        m.release_date,
        m.overview,

        /* CAST */
        COALESCE((
        SELECT json_agg(
                json_build_object(
                    'actor_id', mc.person_id,
                    'actor_name', a.person_name,
                    'character_name', mc.character_name,
                    'cast_order', mc.cast_order
                )
                ORDER BY mc.cast_order
                )
        FROM movie_cast mc
        JOIN person a ON a.person_id = mc.person_id
        WHERE mc.movie_id = m.movie_id
        ), '[]') AS cast,

        /* DIRECTORES */
        COALESCE((
        SELECT json_agg(
                json_build_object(
                    'crew_member_id', cm.person_id,
                    'crew_member_name', p.person_name,
                    'department_name', 'Directing',
                    'job', cm.job
                )
                ORDER BY p.person_name
                )
        FROM movie_crew cm
        JOIN person p     ON p.person_id = cm.person_id
        JOIN department d ON d.department_id = cm.department_id
        WHERE cm.movie_id = m.movie_id
            AND d.department_name = 'Directing'
            AND cm.job = 'Director'
        ), '[]')  AS directors,

        /* ESCRITORES */
        COALESCE((
        SELECT json_agg(
                json_build_object(
                    'crew_member_id', cm.person_id,
                    'crew_member_name', p.person_name,
                    'department_name', 'Writing',
                    'job', cm.job
                )
                ORDER BY p.person_name
                )
        FROM movie_crew cm
        JOIN person p     ON p.person_id = cm.person_id
        JOIN department d ON d.department_id = cm.department_id
        WHERE cm.movie_id = m.movie_id
            AND d.department_name = 'Writing'
            AND cm.job IN ('Writer','Screenplay')
        ), '[]') AS writers,

        /* CREW (resto) */
        COALESCE((
        SELECT json_agg(
                json_build_object(
                    'crew_member_id', cm.person_id,
                    'crew_member_name', p.person_name,
                    'department_name', d.department_name,
                    'job', cm.job
                )
                ORDER BY d.department_name, p.person_name
                )
        FROM movie_crew cm
        JOIN person p     ON p.person_id = cm.person_id
        JOIN department d ON d.department_id = cm.department_id
        WHERE cm.movie_id = m.movie_id
            AND d.department_name NOT IN ('Directing','Writing')
        ), '[]') AS crew,

        /* PAISES */
        COALESCE((
        SELECT json_agg(DISTINCT c.country_name)
        FROM production_country pc
        JOIN country c ON c.country_id = pc.country_id
        WHERE pc.movie_id = m.movie_id
        ), '[]') AS countries,

        /* GENEROS */
        COALESCE((
        SELECT json_agg(DISTINCT g.genre_name)
        FROM movie_genres mg
        JOIN genre g ON g.genre_id = mg.genre_id
        WHERE mg.movie_id = m.movie_id
        ), '[]') AS genres,

        /* IDIOMA ORIGINAL */
        (
        SELECT l.language_name
        FROM movie_languages ml
        JOIN language l     ON l.language_id = ml.language_id
        LEFT JOIN language_role lr ON lr.role_id = ml.language_role_id
        WHERE ml.movie_id = m.movie_id
            AND lr.language_role ILIKE 'original%'
        LIMIT 1
        )  AS original_language,

        /* COMPANIAS */
        COALESCE((
        SELECT json_agg(DISTINCT pc.company_name)
        FROM movie_company mc2
        JOIN production_company pc ON pc.company_id = mc2.company_id
        WHERE mc2.movie_id = m.movie_id
        ), '[]') AS production_companies

    FROM movie m
    WHERE m.movie_id = $1
  `;

  try {
    const { rows } = await db.query(query, [movieId]);
    if (rows.length === 0) return res.status(404).send('Película no encontrada.');


    const r = rows[0];
    const movie = {
      id: r.id,
      title: r.title,
      tagline: r.tagline,
      release_date: r.release_date,
      overview: r.overview,
      directors: r.directors,
      writers: r.writers,
      cast: r.cast,
      crew: r.crew,
      countries: r.countries,
      genres: r.genres,
      originalLanguage: r.original_language,
      productionCompanies: r.production_companies
    };

    res.render('pelicula', { movie });

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
