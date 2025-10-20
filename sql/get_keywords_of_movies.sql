SET search_path = movies, "$user", public;

select m.title, k.keyword_name
from movie_keywords
left join movie as m on m.movie_id = movie_keywords.movie_id
left join keyword as k on k.keyword_id = movie_keywords.keyword_id;