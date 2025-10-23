const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

async function getMoviePoster(title, year) {
    try {
        console.log(`API Key existe: ${!!TMDB_API_KEY}`); // Debug
        
        const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&year=${year}`;
        console.log(`URL de búsqueda: ${searchUrl}`); // Debug
        
        const response = await axios.get(searchUrl);
        
        console.log(`Resultados encontrados: ${response.data.results.length}`); // Debug
        
        if (response.data.results && response.data.results.length > 0) {
            const movie = response.data.results[0];
            console.log(`Poster path: ${movie.poster_path}`); // Debug
            if (movie.poster_path) {
                return `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`;
            }
        }
        return null;
    } catch (error) {
        console.error(`Error completo buscando poster para ${title}:`, error);
        return null;
    }
}

async function getPersonPhoto(personName) {
    try {
        // Buscar la persona por nombre
        const searchUrl = `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(personName)}`;
        const response = await axios.get(searchUrl);
        
        if (response.data.results && response.data.results.length > 0) {
            const person = response.data.results[0];
            if (person.profile_path) {
                return `${TMDB_IMAGE_BASE_URL}${person.profile_path}`;
            }
        }
        return null;
    } catch (error) {
        console.error(`Error buscando foto para ${personName}:`, error.message);
        return null;
    }
}

module.exports = { getMoviePoster, getPersonPhoto };