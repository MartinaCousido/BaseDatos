const express = require("express");
const router = express.Router();
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const db = require("../config/db"); // tu pool PG (igual que en otras rutas)
const { onRatedMovie, onWroteReview } = require("./activity");

// middleware: si no hay token => redirige a login con ?next=...
function ensureAuthRedirect(req, res, next) {
  // el login setea cookies 'access_token' y 'refresh_token' (ver login.js)
  const token = req.cookies && req.cookies.access_token;
  if (!token) {
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${nextUrl}`);
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { uid: payload.uid };
    return next();
  } catch (e) {
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${nextUrl}`);
  }
}

// GET: formulario de review
router.get("/pelicula/:movieId/review", ensureAuthRedirect, async (req, res, next) => {
  try {
    const movieId = Number(req.params.movieId);
    const r = await db.query('SELECT title FROM movie WHERE movie_id = $1', [movieId]);
    const title = r.rows[0]?.title || 'Película';

    // Renderiza una vista simple con el form
    return res.render("review", { movieId, title });
  } catch (err) {
    next(err);
  }
});

// POST: guardar rating + review (ejemplo mínimo)
// Ajusta a tu esquema real (tabla de ratings / tabla de reviews)
router.post("/pelicula/:movieId/review", ensureAuthRedirect, async (req, res, next) => {
  try {
    const uid = req.user.uid; // viene del JWT
    const movieId = Number(req.params.movieId);
    const { rating, reviewText } = req.body;

    // 1) Guarda / actualiza el rating en SQL
    await db.query(`
      INSERT INTO users.user_movie_likes (user_id, movie_id, rating)
      VALUES ($1,$2,$3)
      ON CONFLICT (user_id, movie_id) DO UPDATE SET rating = EXCLUDED.rating
    `, [uid, movieId, rating]);

    // 2) Guarda la reseña en SQL (si escribió algo)
    if (reviewText && reviewText.trim().length) {
      await db.query(`
        INSERT INTO users.movie_reviews (user_id, movie_id, content)
        VALUES ($1,$2,$3)
      `, [uid, movieId, reviewText.trim()]);
    }

    // 3) Obtiene el título para logear en Mongo (feed)
    const t = await db.query(
      'SELECT title FROM movie WHERE movie_id = $1',
      [movieId]
    );
    const movieTitle = t.rows[0]?.title || 'Película';

    // 4) Log en Mongo (actividad) - opcional, esto es solo para el feed
    if (rating) {
      await onRatedMovie({
        userId: uid,
        movieId,
        movieTitle,
        rating: Number(rating)
      });
    }

    if (reviewText && reviewText.trim().length) {
      await onWroteReview({
        userId: uid,
        movieId,
        movieTitle,
        reviewId: `tmp-${uid}-${movieId}`
      });
    }

    // 5) Redirige de vuelta al detalle de la peli
    return res.redirect(`/pelicula/${movieId}`);
  } catch (err) {
    next(err);
  }
});

// Helpers para "hace 2 horas", "hace 3 días", etc.
function timeAgo(date) {
  if (!date) return "";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return "hace unos segundos";
  if (diffMin < 60) return `hace ${diffMin} minuto${diffMin === 1 ? "" : "s"}`;
  if (diffHrs < 24) return `hace ${diffHrs} hora${diffHrs === 1 ? "" : "s"}`;
  return `hace ${diffDays} día${diffDays === 1 ? "" : "s"}`;
}

// GET: ver ratings + reseñas de todos los usuarios para una película
router.get("/pelicula/:movieId/resenas", async (req, res, next) => {
  try {
    const movieId = Number(req.params.movieId);

    // Título de la película
    const movieResult = await db.query(
      "SELECT title FROM movie WHERE movie_id = $1",
      [movieId]
    );
    const title = movieResult.rows[0]?.title || "Película";

    // Traer username, rating y reseña
    const reviewsResult = await db.query(`
      SELECT 
        u.username,
        l.rating,
        r.content,
        r.created_at
      FROM users.movie_reviews r
      JOIN users.user_movie_likes l
        ON l.user_id = r.user_id AND l.movie_id = r.movie_id
      JOIN users."user" u
        ON u.user_id = r.user_id
      WHERE r.movie_id = $1
      ORDER BY r.created_at DESC;
    `, [movieId]);

    const reviews = reviewsResult.rows.map(row => ({
      ...row,
      timeAgo: row.created_at ? timeAgo(row.created_at) : null
    }));

    return res.render("movie_reviews", {
      movieId,
      title,
      reviews
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
