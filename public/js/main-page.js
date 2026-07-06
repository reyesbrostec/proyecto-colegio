/* main-page.js — Carga de noticias desde la API + fallback estático
   ========================================================================== */

(function () {
    'use strict';

    function init() {
        var noticiasContainer = document.getElementById('noticias-container');
        if (!noticiasContainer) return;

        var API_URL = 'https://colegio-backend-6oun.onrender.com/api';

        // Añadir skeleton loader mientras carga
        noticiasContainer.innerHTML =
            '<div class="news-item animate-pulse"><div class="h-6 bg-gray-200 rounded w-3/4 mb-4"></div><div class="h-4 bg-gray-200 rounded w-full mb-2"></div><div class="h-4 bg-gray-200 rounded w-5/6"></div></div>' +
            '<div class="news-item animate-pulse"><div class="h-6 bg-gray-200 rounded w-3/4 mb-4"></div><div class="h-4 bg-gray-200 rounded w-full mb-2"></div><div class="h-4 bg-gray-200 rounded w-5/6"></div></div>' +
            '<div class="news-item animate-pulse"><div class="h-6 bg-gray-200 rounded w-3/4 mb-4"></div><div class="h-4 bg-gray-200 rounded w-full mb-2"></div><div class="h-4 bg-gray-200 rounded w-5/6"></div></div>';

        fetch(API_URL + '/noticias')
            .then(function (response) {
                if (!response.ok) throw new Error('Error de red');
                return response.json();
            })
            .then(function (noticias) {
                if (!noticias || noticias.length === 0) {
                    noticiasContainer.innerHTML =
                        '<p class="col-span-full text-center text-gray-500 py-8">No hay noticias para mostrar en este momento.</p>';
                    return;
                }
                noticiasContainer.innerHTML = '';
                noticias.forEach(function (noticia) {
                    var article = document.createElement('article');
                    article.className = 'news-item';

                    var html = '';

                    // Imagen
                    if (noticia.imagen_url) {
                        html += '<img src="' + escapeHtml(noticia.imagen_url) + '" alt="' + escapeHtml(noticia.titulo) + '" class="news-image" loading="lazy" onerror="this.style.display=\'none\'">';
                    }

                    // Video YouTube
                    if (noticia.video_url) {
                        var videoId = extractYouTubeId(noticia.video_url);
                        if (videoId) {
                            html += '<div class="news-video"><iframe src="https://www.youtube.com/embed/' + videoId + '" title="' + escapeHtml(noticia.titulo) + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
                        }
                    }

                    html += '<div class="news-item-content">' +
                        '<h3>' + escapeHtml(noticia.titulo) + '</h3>' +
                        '<p>' + escapeHtml(noticia.contenido) + '</p>';

                    if (noticia.creado_en) {
                        var fecha = new Date(noticia.creado_en).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
                        html += '<span class="news-date">' + fecha + '</span>';
                    }

                    html += '</div>';
                    article.innerHTML = html;
                    noticiasContainer.appendChild(article);
                });
            })
            .catch(function () {
                // Fallback silencioso: mostrar noticias estáticas de ejemplo
                noticiasContainer.innerHTML =
                    '<article class="news-item">' +
                    '<h3>¡Bienvenidos al Nuevo Año Escolar!</h3>' +
                    '<p class="text-gray-600">Estamos muy emocionados de comenzar un nuevo ciclo lleno de aprendizaje y nuevas aventuras. ¡Consulten el calendario para las fechas importantes!</p>' +
                    '</article>' +
                    '<article class="news-item">' +
                    '<div class="news-item-content">' +
                    '<h3>Reunión de Padres de Familia</h3>' +
                    '<p>La primera reunión de padres de familia se llevará a cabo el próximo viernes a las 18:00 en el auditorio principal. ¡No falten!</p>' +
                    '</div>' +
                    '</article>' +
                    '<article class="news-item">' +
                    '<div class="news-item-content">' +
                    '<h3>Inscripciones Abiertas 2025-2026</h3>' +
                    '<p>Ya están abiertas las inscripciones para el próximo año lectivo. Visita nuestra sección de documentos para más información.</p>' +
                    '</div>' +
                    '</article>';
            });
    }

    // Escape HTML para prevenir XSS
    function escapeHtml(text) {
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    // Extraer ID de YouTube de varias URL posibles
    function extractYouTubeId(url) {
        if (!url) return null;
        var patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\s?#]+)/,
            /youtube\.com\/shorts\/([^&\s?#]+)/
        ];
        for (var i = 0; i < patterns.length; i++) {
            var match = url.match(patterns[i]);
            if (match && match[1]) return match[1];
        }
        return null;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
