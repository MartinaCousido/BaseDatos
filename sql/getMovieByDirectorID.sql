SET search_path = movies, "$user", public;

select distinct title
from movie_crew as mc
left join movie as m on m.movie_id = mc.movie_id
where job ilike '%director%' and mc.person_id = 1322142;