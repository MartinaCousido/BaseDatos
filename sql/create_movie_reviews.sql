DROP TABLE IF EXISTS users.movie_reviews;
CREATE TABLE IF NOT EXISTS users.movie_reviews (
    review_id  SERIAL PRIMARY KEY,
    user_id    INT NOT NULL,
    movie_id   INT NOT NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id)
        REFERENCES users.'user'(user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (movie_id)
        REFERENCES movies.movie(movie_id)
        ON DELETE CASCADE
);
