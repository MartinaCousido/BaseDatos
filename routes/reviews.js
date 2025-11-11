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

    // 1) Guarda en SQL (ajusta a tu diseño real)
    // rating (upsert) — ejemplo:
    await db.query(`
        INSERT INTO user_likes_movie (user_id, movie_id, rating)
        VALUES ($1,$2,$3)
        ON CONFLICT (user_id, movie_id) DO UPDATE SET rating = EXCLUDED.rating
      `, [uid, movieId, rating]);

    // review — ejemplo mínimo (crea tu tabla si aún no la tienes)
    // const rv = await db.query(
    //   'INSERT INTO review (user_id, movie_id, content) VALUES ($1,$2,$3) RETURNING review_id',
    //   [uid, movieId, reviewText]
    // );
    // const reviewId = rv.rows[0].review_id;

    // 2) Trae el título de SQL para denormalizar a Mongo
    const t = await db.query('SELECT title FROM movie WHERE movie_id = $1', [movieId]);
    const movieTitle = t.rows[0]?.title || 'Película';

    // 3) Log en Mongo (feed)
    if (rating) {
      await onRatedMovie({ userId: uid, movieId, movieTitle, rating: Number(rating) });
    }
    if (reviewText && reviewText.trim().length) {
      // si implementas review real en SQL, usa su reviewId real
      await onWroteReview({ userId: uid, movieId, movieTitle, reviewId: `tmp-${uid}-${movieId}` });
    }

    // 4) Redirige al detalle de la película
    return res.redirect(`/pelicula/${movieId}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
