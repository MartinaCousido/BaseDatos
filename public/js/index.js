// Espera a que la página se cargue
window.addEventListener('DOMContentLoaded', (event) => {

    const navbar = document.querySelector('.navbar');

    // Escucha el evento de scroll en la ventana
    window.addEventListener('scroll', () => {
        // Si el scroll vertical es mayor a 50 píxeles...
        if (window.scrollY > 50) {
            // ...añade la clase 'visible' a la navbar para mostrarla
            navbar.classList.add('visible');
        } else {
            // ...si no, quita la clase para ocultarla
            navbar.classList.remove('visible');
        }
    });

});