const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Ruta para la página de datos de una película particular (PostgreSQL)
router.get('/pelicula/:id', async (req, res) => {
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

module.exports = router;