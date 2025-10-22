const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/actor/:id', async (req, res) => {
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

module.exports = router;