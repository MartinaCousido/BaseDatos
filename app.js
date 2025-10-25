require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3500;
const cookieParser = require('cookie-parser');

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('views'));
app.use(express.static('public'));

const indexRoutes = require('./routes/index');
const searchRoutes = require('./routes/results');
const movieRoutes = require('./routes/movies');
const actorRoutes = require('./routes/actor');
const directorRoutes = require('./routes/director');
const loginRoutes = require('./routes/login');
const registerRoutes = require('./routes/register')
const profileRoutes = require('./routes/profile');
const navbarRoutes = require('./routes/utils');

app.use(navbarRoutes);

app.use([
    indexRoutes,
    searchRoutes,
    movieRoutes,
    actorRoutes,
    directorRoutes,
    loginRoutes,
    registerRoutes,
    profileRoutes,
    navbarRoutes
]);

app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
