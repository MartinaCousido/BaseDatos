DROP TABLE IF EXISTS users.user_movie_likes;
CREATE TABLE users.user_movie_likes (
    user_id INT NOT NULL,
    movie_id INT NOT NULL,  -- <--- COMA AÑADIDA AQUÍ
    PRIMARY KEY (user_id, movie_id), -- <--- COMA AÑADIDA AQUÍ
    FOREIGN KEY (user_id) 
        REFERENCES users.user(user_id) 
        ON DELETE CASCADE,
    FOREIGN KEY (movie_id) 
        REFERENCES movies.movie(movie_id) 
        ON DELETE CASCADE
);