require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3500;

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('views'));
app.use(express.static('public'));

const indexRoutes = require('./routes/index');
const searchRoutes = require('./routes/results');
const movieRoutes = require('./routes/movies');
const actorRoutes = require('./routes/actor');
const directorRoutes = require('./routes/director');
const loginRoutes = require('./routes/login');

app.use([
    indexRoutes,
    searchRoutes,
    movieRoutes,
    actorRoutes,
    directorRoutes,
    loginRoutes,
]);

app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
