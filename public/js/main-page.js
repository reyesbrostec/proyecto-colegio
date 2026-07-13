/* main-page.js — Carga de noticias desde la API + fallback estático
   ========================================================================== */

(function () {
    'use strict';

    function init() {
        var noticiasContainer = document.getElementById('noticias-container');
        if (!noticiasContainer) return;

        var API_URL = '/api';

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

                    // Video (YouTube / Vimeo / futuro PeerTube)
                    if (noticia.video_url) {
                        var embedData = getVideoEmbed(noticia.video_url);
                        if (embedData) {
                            html += '<div class="news-video"><iframe src="' + embedData.src + '" title="' + escapeHtml(noticia.titulo) + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
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
                    '<p>Ya están abiertas las inscripciones para el próximo año lectivo. Visite nuestra sección de documentos para más información.</p>' +
                    '</div>' +
                    '</article>';
            });
    }

    // Escape HTML para prevenir XSS
    function escapeHtml(text) {
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    /**
     * Obtener URL de embed para video.
     * Soporta: YouTube (watch, embed, shorts, youtu.be, nocookie),
     *          Vimeo (vimeo.com/ID),
     *          PeerTube (listo para futuro: /w/ID o /videos/embed/ID)
     * @param {string} url - URL del video
     * @returns {{src: string}|null}
     */
    function getVideoEmbed(url) {
        if (!url) return null;

        // ── YouTube (modo nocookie para privacidad LOPDD) ──
        var ytPatterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube-nocookie\.com\/embed\/)([^&\s?#]+)/,
            /youtube\.com\/shorts\/([^&\s?#]+)/
        ];
        for (var i = 0; i < ytPatterns.length; i++) {
            var ytMatch = url.match(ytPatterns[i]);
            if (ytMatch && ytMatch[1]) {
                return { src: 'https://www.youtube-nocookie.com/embed/' + ytMatch[1] };
            }
        }

        // ── Vimeo ──
        var vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch && vimeoMatch[1]) {
            return { src: 'https://player.vimeo.com/video/' + vimeoMatch[1] + '?dnt=1' };
        }

        // ── PeerTube (futuro) — placeholder para cuando se implemente ──
        // Ejemplo: https://peertube.ejemplo.ec/w/abc123 → /videos/embed/abc123
        // var peertubeMatch = url.match(/peertube\.[^/]+\/w\/([^&\s?#]+)/);
        // if (peertubeMatch && peertubeMatch[1]) {
        //     return { src: url.replace(/\/w\//, '/videos/embed/') };
        // }

        return null;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
