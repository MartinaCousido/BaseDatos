// Se debe crear archivo .env con las variables de entorno de la base de datos
// DB_USER=postgres
// DB_PASSWORD=<password_de_la_base_de_datos>
// DB_HOST=localhost
// DB_PORT=5432
// DB_DATABASE=movies

require('dotenv').config();

const express = require('express');

const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3500;

// Serve static files from the "views" directory
app.use(express.static('views'));

// Servir archivos estáticos (CSS, JS del cliente) desde la carpeta 'public'
app.use(express.static('public'));

// Crear un "pool" de conexiones a PostgreSQL usando las variables de entorno
const db = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    options: `-c search_path=movies,public`, //modificar options de acuerdo al nombre del esquema
});

async function getFormatedMoviesForSearchValue(toSearch, limit = 100 ) {
    const start = 'SELECT * FROM movie WHERE title ILIKE $1 LIMIT ' + String(limit); // ILIKE es case-insensitive en Postgres
    const contains = `SELECT * FROM movie WHERE title ILIKE $1 AND NOT title ILIKE $2 LIMIT ` + String(limit); // ILIKE es case-insensitive en Postgres
    
    const has_actor = 
    `SELECT m.title
    FROM movie m
    JOIN movie_cast mc ON m.movie_id = mc.movie_id
    join person p on p.person_id = mc.person_id
    WHERE p.person_name ilike $1
    LIMIT
    ` + String(limit);

    // const review = 'SELECT * FROM movie WHERE (overview ILIKE $1 OR tagline ILIKE $1) AND NOT title ILIKE $2 LIMIT ' + String(limit);

    try{
        const response = await db.query(start, [`${toSearch}%`]);
        const response_a = await db.query(has_actor, [`${toSearch}%`]);
        const response_c = await db.query(contains, [`%${toSearch}%`, `${toSearch}%`]);
        
        response.rows = response.rows.concat(response_c.rows);

        return response.rows.concat(response_a.rows);

    }catch(error) {
        console.log(error);
        return [];
    }
}

async function getFormatedActorsForSearchValue(toSearch, limit = 100) {

    const astart = 
    `SELECT DISTINCT person_name, person.person_id 
    FROM person 
    left join movie_cast as mc on person.person_id = mc.person_id 
    WHERE person_name ILIKE $1 AND character_name IS NOT NULL
    LIMIT ${String(limit)}`;

    const acontains = 
    `SELECT DISTINCT person_name, person.person_id
    FROM person 
    left join movie_cast as mc on person.person_id = mc.person_id 
    WHERE person_name ILIKE $1 AND NOT person_name ILIKE $2 AND character_name IS NOT NULL
    LIMIT ${String(limit)}`;

    const s_values = [`${toSearch}%`];
    const c_values = [`%${toSearch}%`, `${toSearch}%`];

    try{
        const response = await db.query(astart, s_values);
        const response_c = await db.query(acontains, c_values);

        return response.rows.concat(response_c.rows);

    }catch(error) {
        console.log(error);
        return [];
    }
}

async function getFormatedDirectorsForSearchValue(toSearch, limit = 100) {
    const start = 
    `select distinct person_name, person.person_id
    from person
    left join movie_crew as mc on person.person_id = mc.person_id
    where job ilike '%director%' and person.person_name ilike $1
    limit ${limit}`;

    const contains = 
    `select distinct person_name, person.person_id
    from person
    left join movie_crew as mc on person.person_id = mc.person_id
    where job ilike '%director%' and person.person_name ilike $1 and NOT person.person_name ILIKE $2
    limit ${limit}`;

    const s_values = [`${toSearch}%`];
    const c_values = [`%${toSearch}%`, `${toSearch}%`];

    try{
        const response = await db.query(start, s_values);
        const response_c = await db.query(contains, c_values);

        return response.rows.concat(response_c.rows);

    }catch(error) {
        console.log(error);
        return [];
    }
}

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para buscar películas en la base de datos PostgreSQL
app.get('/buscar', async (req, res) => { // 4. Convertir a función async
    const searchTerm = req.query.q;
    const limit = 100;

    try {
        const response_movies = await getFormatedMoviesForSearchValue(searchTerm);
        const response_actors = await getFormatedActorsForSearchValue(searchTerm);
        const response_directors = await getFormatedDirectorsForSearchValue(searchTerm);

        // if the search term is nothing show the first 100s and sorted
        if (searchTerm.length <= 0) {
            response_movies.sort((a, b) => a.title < b.title ? -1 : a.title == b.title ? 0 : 1)
            response_actors.sort((a, b) => a.person_name < b.person_name ? -1 : a.person_name == b.person_name ? 0 : 1)
            response_directors.sort((a, b) => a.person_name < b.person_name ? -1 : a.person_name == b.person_name ? 0 : 1)
        }

        res.render('resultado', { 
            toSearch: searchTerm,
            movies: response_movies,
            actors: response_actors,
            directors: response_directors,
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Error en la búsqueda.');
    }
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
