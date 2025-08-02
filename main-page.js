document.addEventListener('DOMContentLoaded', () => {
    const noticiasContainer = document.getElementById('noticias-container');
    if (!noticiasContainer) return;

    // URL del backend
    const API_URL = 'https://colegio-backend-6oun.onrender.com/api';

    fetch(`${API_URL}/noticias`)
        .then(response => {
            if (!response.ok) {
                throw new Error('La respuesta de la red no fue exitosa');
            }
            return response.json();
        })
        .then(noticias => {
            if (!noticias || noticias.length === 0) {
                noticiasContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">No hay noticias para mostrar en este momento.</p>';
                return;
            }

            noticiasContainer.innerHTML = ''; // Limpiamos el contenedor
            noticias.forEach(noticia => {
                const article = document.createElement('article');
                article.className = 'news-item bg-white p-6 rounded-lg shadow-md';
                article.innerHTML = `
                    <h3 class="text-xl font-bold mb-2">${noticia.titulo}</h3>
                    <p class="text-gray-700">${noticia.contenido}</p>
                `;
                noticiasContainer.appendChild(article);
            });
        })
        .catch(error => {
            console.error('Error al cargar las noticias:', error);
            noticiasContainer.innerHTML = '<p class="col-span-full text-center text-red-500">No se pudieron cargar las noticias en este momento.</p>';
        });
});