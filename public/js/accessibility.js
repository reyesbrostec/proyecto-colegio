/* accessibility.js — Mejoras de accesibilidad globales
   - Skip link (ya en HTML, solo aseguramos foco)
   - Panel de accesibilidad básico
   - Anuncio de errores para lectores de pantalla
   - Estilos de foco forzados
   ========================================================================== */

(function () {
    'use strict';

    // ── Anunciador ARIA Live para lectores de pantalla ──
    function ensureAriaLive() {
        if (document.getElementById('aria-live-announcer')) return;
        const el = document.createElement('div');
        el.id = 'aria-live-announcer';
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
        document.body.appendChild(el);
    }

    // ── Añadir aria-current a enlaces de navegación ──
    function markCurrentNav() {
        const currentPath = location.pathname.replace(/\/$/, '') || '/index.html';
        const navLinks = document.querySelectorAll('nav a');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            // Comparar rutas
            const linkPath = href.startsWith('/') ? href : '/' + href;
            if (currentPath.endsWith(href) || currentPath.endsWith(linkPath)) {
                link.setAttribute('aria-current', 'page');
            }
        });
    }

    // ── Hacer accesibles los iconos emoji ──
    function hideDecorativeEmoji() {
        document.querySelectorAll('.pillar-icon, .feature-icon, .document-icon').forEach(el => {
            if (el.textContent.trim().match(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}]+$/u)) {
                el.setAttribute('aria-hidden', 'true');
            }
        });
    }

    // ── Init ──
    function init() {
        ensureAriaLive();
        markCurrentNav();
        hideDecorativeEmoji();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ── API pública ──
    window.Accessibility = {
        announce: function (message) {
            const el = document.getElementById('aria-live-announcer');
            if (el) {
                el.textContent = '';
                requestAnimationFrame(() => { el.textContent = message; });
            }
        }
    };
})();
