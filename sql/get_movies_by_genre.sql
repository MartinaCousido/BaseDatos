SET search_path = movies, "$user", public;

select m.*
from genre
join movie_genres as mg on genre.genre_id = mg.genre_id
join movie as m on mg.movie_id = m.movie_id
where genre.genre_name ilike "Horror";