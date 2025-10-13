SET search_path = movies, "$user", public;

SELECT DISTINCT person_name
FROM person
left join movie_cast as mc on person.person_id = mc.person_id
where person_name ilike 'tom%';