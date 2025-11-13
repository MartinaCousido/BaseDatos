// src/utils/renderActivity.js
function renderActivity(item) {
  const d = item.details || {};
  switch (item.type) {
    case "RATED_MOVIE":
      return `Calificó “${d.movieTitle}” con ${d.rating} ★`;
    case "ADDED_TO_FAVORITES":
      return `Añadió “${d.movieTitle}” a favoritos`;
    case "WROTE_REVIEW":
      return `Escribió una reseña de “${d.movieTitle}”`;
    default:
      return "Actividad";
  }
}
module.exports = { renderActivity };
