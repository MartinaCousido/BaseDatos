-- Table to cache poster URLs per movie
CREATE TABLE IF NOT EXISTS public.movie_posters (
  movie_id INTEGER PRIMARY KEY,
  poster_url TEXT,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movie_posters_movie_id ON public.movie_posters(movie_id);
