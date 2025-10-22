const express = require('express');
const router = express.Router();
const db = require('../config/db');

// DIRECTOR
router.get('/director/:id', async (req, res) => {
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

module.exports = router;