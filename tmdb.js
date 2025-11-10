const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

async function getMoviePoster(title, year) {
    try {
        const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&year=${year}`;
        console.log('Buscando poster con URL:', searchUrl);
        const response = await axios.get(searchUrl);
        if (response.data.results && response.data.results.length > 0) {
            const movie = response.data.results[0];
            if (movie.poster_path) return `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`;
        }
        return null;
    } catch (error) {
        console.error(`Error completo buscando poster para ${title}:`, error);
        return null;
    }
}

module.exports = { getMoviePoster };