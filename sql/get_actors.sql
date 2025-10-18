SET search_path = movies, "$user", public;

SELECT DISTINCT *
FROM person
left join movie_cast as mc on person.person_id = mc.person_id
where person_name ilike 'tom%' AND character_name is not null;