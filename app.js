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
    options: `-c search_path=movies,public`, //modificar options de acuerdo al nombre del esquema
});

app.set('view engine', 'ejs');

// --- NUEVAS FUNCIONES DE BÚSQUEDA CON PAGINACIÓN SQL ---

async function getPaginatedMovies(toSearch, limit, offset) {
    // La lógica de prioridad se mantiene:
    // 1: Títulos que empiezan con el término.
    // 2: Títulos que contienen el término.
    // 3: Relacionados (en overview o tagline).
    const baseQuery = `
        (SELECT *, 1 as priority FROM movie WHERE title ILIKE $1)
        UNION ALL
        (SELECT *, 2 as priority FROM movie WHERE title ILIKE $2 AND NOT title ILIKE $1)
        UNION ALL
        (SELECT *, 3 as priority FROM movie WHERE (overview ILIKE $3 OR tagline ILIKE $3) AND NOT title ILIKE $1)
    `;

    const query = `SELECT * FROM (${baseQuery}) as results ORDER BY priority, title LIMIT $4 OFFSET $5`;
    const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) as results`;

    const values = [`${toSearch}%`, `%${toSearch}%`, `% ${toSearch} %`];

    try {
        const resultsPromise = await db.query(query, [...values, limit, offset]);
        const countPromise = await db.query(countQuery, values);
        
        return {
            rows: resultsPromise.rows,
            total: parseInt(countPromise.rows[0].count, 10) || 0
        };
    } catch (error) {
        console.log(error);
        return { rows: [], total: 0 };
    }
}

async function getPaginatedPeople(toSearch, limit, offset, type = 'actor') {
    const jobFilter = type === 'director' 
        ? `JOIN movie_crew as mc on p.person_id = mc.person_id WHERE job ILIKE '%director%' AND`
        : `JOIN movie_cast as mc on p.person_id = mc.person_id WHERE mc.character_name IS NOT NULL AND`;
    
    const baseQuery = `
        (SELECT p.person_id, p.person_name, 1 as priority FROM person as p ${jobFilter} p.person_name ILIKE $1)
        UNION ALL
        (SELECT p.person_id, p.person_name, 2 as priority FROM person as p ${jobFilter} p.person_name ILIKE $2 AND NOT p.person_name ILIKE $1)
    `;

    const query = `SELECT * FROM (SELECT DISTINCT person_id, person_name, priority FROM (${baseQuery}) as u) as results ORDER BY priority, person_name LIMIT $3 OFFSET $4`;
    const countQuery = `SELECT COUNT(DISTINCT person_id) FROM (${baseQuery}) as results`;

    const values = [`${toSearch}%`, `%${toSearch}%`];
    
    try {
        const results = await db.query(query, [...values, limit, offset]);
        const count = await db.query(countQuery, values);
        
        return {
            rows: results.rows,
            total: parseInt(count.rows[0].count, 10) || 0
        };
    } catch (error) {
        console.log(error);
        return { rows: [], total: 0 };
    }
}

// En tu app.js

app.get('/buscar', async (req, res) => {
    const searchTerm = req.query.q || '';
    // Esta línea es clave: define la variable 'activeTab' a partir de la URL o le da un valor por defecto.
    const activeTab = req.query.tab || 'peliculas'; 
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    // ... (la lógica para determinar los offsets) ...
    const moviesOffset = (activeTab === 'peliculas') ? offset : 0;
    const actorsOffset = (activeTab === 'actores') ? offset : 0;
    const directorsOffset = (activeTab === 'directores') ? offset : 0;

    // ... (las llamadas a las funciones de búsqueda) ...
    const moviesData = await getPaginatedMovies(searchTerm, limit, moviesOffset);
    const actorsData = await getPaginatedPeople(searchTerm, limit, actorsOffset, 'actor');
    const directorsData = await getPaginatedPeople(searchTerm, limit, directorsOffset, 'director');
    // ✅ ASEGÚRATE DE QUE ESTA LÍNEA ESTÉ PRESENTE
    // Aquí es donde le pasas la variable 'activeTab' a tu plantilla EJS.
    res.render('resultado', {
        toSearch: searchTerm,
        activeTab: activeTab, // <--- ¡Esta es la línea que falta o es incorrecta!
        movies: { 
            rows: moviesData.rows, 
            totalPages: Math.ceil(moviesData.total / limit) 
        },
        actors: { 
            rows: actorsData.rows, 
            totalPages: Math.ceil(actorsData.total / limit) 
        },
        directors: { 
            rows: directorsData.rows, 
            totalPages: Math.ceil(directorsData.total / limit) 
        },
        currentPage: page,
    });
});

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para la página de datos de una película particular (PostgreSQL)
app.get('/pelicula/:id', async (req, res) => { // Convertir a async
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
      movie_crew.job
    FROM movie
    LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
    LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    LEFT JOIN department ON movie_crew.department_id = department.department_id
    LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id
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
        };

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

        rows.forEach((row) => {
            if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                const isDuplicate = movieData.writers.some((crew_member) => crew_member.crew_member_id === row.crew_member_id);
                if (!isDuplicate && row.department_name === 'Writing' && (row.job === 'Writer' || row.job === 'Screenplay')) { // Ajuste para más roles de escritura
                    movieData.writers.push({
                        crew_member_id: row.crew_member_id,
                        crew_member_name: row.crew_member_name,
                        department_name: row.department_name,
                        job: row.job,
                    });
                }
            }
        });

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
        // Consulta: obtener nombre del actor y las películas donde participó
        const actorResult = await db.query('SELECT person_name FROM person WHERE person_id = $1', [actorId]);
        const moviesResult = await db.query(`
            SELECT m.movie_id, m.title, m.release_date
            FROM movie m
            JOIN movie_cast mc ON m.movie_id = mc.movie_id
            WHERE mc.person_id = $1
        `, [actorId]);
        
        const actorName = actorResult.rows[0]?.person_name || 'Actor desconocido';
        const movies = moviesResult.rows;

        res.render('actor', { actorName, movies });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener información del actor');
    }
});

// DIRECTOR
app.get('/director/:id', async (req, res) => {
    const directorId = req.params.id;
    try {
        // Consulta: obtener nombre del director y las películas que dirigió
        const directorResult = await db.query('SELECT person_name FROM person WHERE person_id = $1', [directorId]);
        const moviesResult = await db.query(`
            SELECT m.movie_id, m.title, m.release_date
            from movie_crew as mc
            left join movie as m on m.movie_id = mc.movie_id
            where job ilike '%director%' and mc.person_id = $1
        `, [directorId]);

        const directorName = directorResult.rows[0]?.person_name || 'Director desconocido';
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
