/* contact.js — Validación del formulario de contacto (v2 · Seguridad)
   - Validación en tiempo real (blur) con feedback accesible
   - Resumen de errores con enlaces a campos
   - Turnstile CAPTCHA (Cloudflare — invisible, sin fricción)
   - Honeypot detection (campo oculto anti-bots)
   - Envío a /api/contacto con verificación server-side
   - Phone validation + XSS sanitization
   ========================================================================== */

(function () {
    'use strict';

    // ── Config ──
    var TURNSTILE_SITEKEY = (function () {
        var meta = document.querySelector('meta[name="turnstile:sitekey"]');
        return meta ? meta.getAttribute('content') : '';
    })();

    function validEmail(email) {
        return /^[^\s@<>]{1,150}@[^\s@<>]{1,100}\.[^\s@<>]{1,50}$/.test(email);
    }

    function validPhone(phone) {
        if (!phone) return true; // optional
        return /^[\d\s\-\+\(\)]{7,20}$/.test(phone);
    }

    function sanitize(val) {
        return val.replace(/[<>]/g, '').trim();
    }

    // ── Mostrar/ocultar error de campo ──
    function setFieldError(field, message) {
        var errorId = field.id + '-error';
        var errorEl = document.getElementById(errorId);
        if (message) {
            field.setAttribute('aria-invalid', 'true');
            field.setAttribute('aria-describedby', errorId);
            if (!errorEl) {
                errorEl = document.createElement('p');
                errorEl.id = errorId;
                errorEl.className = 'form-error';
                errorEl.setAttribute('role', 'alert');
                field.parentNode.appendChild(errorEl);
            }
            errorEl.textContent = message;
        } else {
            field.removeAttribute('aria-invalid');
            field.removeAttribute('aria-describedby');
            if (errorEl) errorEl.remove();
        }
    }

    // ── Mostrar resumen de errores ──
    function showErrorSummary(errors, form) {
        var summary = document.getElementById('form-error-summary');
        if (!summary) {
            summary = document.createElement('div');
            summary.id = 'form-error-summary';
            summary.className = 'form-error-summary';
            summary.setAttribute('role', 'alert');
            summary.setAttribute('aria-hidden', 'true');
            form.parentNode.insertBefore(summary, form);
        }
        var list = errors.map(function (err) {
            return '<li><a href="#' + err.id + '">' + err.message + '</a></li>';
        }).join('');
        summary.innerHTML = '<h3>Se encontraron ' + errors.length + ' error(es) en el formulario:</h3><ul>' + list + '</ul>';
        summary.setAttribute('aria-hidden', 'false');

        // Actualizar título de página
        document.title = '(' + errors.length + ') Error(es) — ' + document.title.replace(/^\(\d+\)\s*Error\(es\)\s*—\s*/, '');

        // Enfocar primer campo con error
        if (errors.length > 0) {
            var firstField = document.getElementById(errors[0].id);
            if (firstField) firstField.focus();
        }

        // Anunciar a lectores de pantalla
        if (window.Accessibility && window.Accessibility.announce) {
            window.Accessibility.announce('Se encontraron ' + errors.length + ' errores en el formulario.');
        }
    }

    function hideErrorSummary() {
        var summary = document.getElementById('form-error-summary');
        if (summary) summary.setAttribute('aria-hidden', 'true');
        document.title = document.title.replace(/^\(\d+\)\s*Error\(es\)\s*—\s*/, '');
    }

    // ── Validar campo individual ──
    function validateField(field) {
        var value = field.value.trim();
        var id = field.id;
        if (field.hasAttribute('required') && !value) {
            return { id: id, message: 'Este campo es obligatorio.' };
        }
        if (!value) return null; // optional field, empty is OK
        if (field.type === 'email' && !validEmail(value)) {
            return { id: id, message: 'Ingresa un correo electrónico válido.' };
        }
        if (id === 'phone' && !validPhone(value)) {
            return { id: id, message: 'Ingresa un número de teléfono válido.' };
        }
        if (id === 'message' && value.length < 10) {
            return { id: id, message: 'El mensaje debe tener al menos 10 caracteres.' };
        }
        if ((id === 'name' || id === 'subject') && value.length < 3) {
            return { id: id, message: 'Este campo debe tener al menos 3 caracteres.' };
        }
        return null;
    }

    // ── Validar formulario completo ──
    function validateForm(form) {
        var fields = form.querySelectorAll('input[required], textarea[required], input#phone');
        var errors = [];
        fields.forEach(function (field) {
            var error = validateField(field);
            if (error) {
                errors.push(error);
                setFieldError(field, error.message);
            } else {
                setFieldError(field, null);
            }
        });
        return errors;
    }

    // ── Mostrar éxito ──
    function showSuccess(form, message) {
        var existing = document.getElementById('form-success');
        if (existing) existing.remove();
        var successEl = document.createElement('div');
        successEl.id = 'form-success';
        successEl.className = 'form-success';
        successEl.setAttribute('role', 'status');
        successEl.textContent = message;
        form.parentNode.insertBefore(successEl, form.nextSibling);
        form.reset();
        setTimeout(function () {
            if (successEl.parentNode) successEl.remove();
        }, 8000);
    }

    // ── Inicializar ──
    function init() {
        var form = document.getElementById('contact-form');
        if (!form) return;

        var submitBtn = form.querySelector('button[type="submit"]');

        // Validación en blur (al salir del campo)
        var fields = form.querySelectorAll('input[required], textarea[required]');
        fields.forEach(function (field) {
            field.addEventListener('blur', function () {
                var error = validateField(field);
                if (error) {
                    setFieldError(field, error.message);
                } else {
                    setFieldError(field, null);
                }
            });
            // Limpiar error al empezar a escribir
            field.addEventListener('input', function () {
                if (field.hasAttribute('aria-invalid')) {
                    setFieldError(field, null);
                    hideErrorSummary();
                }
            });
        });

        // Envío del formulario
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            hideErrorSummary();

            // Honeypot check (client-side early detection)
            var honeypot = form.querySelector('#website');
            if (honeypot && honeypot.value.trim() !== '') {
                // Bot detected — silently "succeed"
                showSuccess(form, '¡Mensaje enviado con éxito! Nos pondremos en contacto pronto.');
                return;
            }

            var errors = validateForm(form);
            if (errors.length > 0) {
                showErrorSummary(errors, form);
                return;
            }

            var payload = {
                nombre: sanitize(form.querySelector('#name').value),
                email: sanitize(form.querySelector('#email').value),
                telefono: sanitize(form.querySelector('#phone') ? form.querySelector('#phone').value : ''),
                asunto: sanitize(form.querySelector('#subject').value),
                mensaje: sanitize(form.querySelector('#message').value),
                website: '', // honeypot
                page: location.pathname
            };

            var btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
            var btnLoading = submitBtn ? submitBtn.querySelector('.btn-loading') : null;
            if (btnText) btnText.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'inline';
            if (submitBtn) submitBtn.disabled = true;

            // Get Turnstile token if widget is present
            function doSubmit(turnstileToken) {
                if (turnstileToken) payload.turnstileToken = turnstileToken;

                fetch('/api/contacto', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
                .then(function (result) {
                    if (!result.ok) throw new Error(result.data.error || 'Error del servidor');
                    showSuccess(form, result.data.message || '¡Mensaje enviado con éxito! Nos pondremos en contacto pronto.');
                })
                .catch(function (err) {
                    var errorMsg = err.message || 'Hubo un problema al enviar tu mensaje. Intenta de nuevo más tarde.';
                    showErrorSummary([{ id: 'name', message: errorMsg }], form);
                })
                .finally(function () {
                    if (btnText) btnText.style.display = 'inline';
                    if (btnLoading) btnLoading.style.display = 'none';
                    if (submitBtn) submitBtn.disabled = false;
                    // Reset Turnstile if present
                    if (typeof turnstile !== 'undefined' && turnstile.reset) {
                        try { turnstile.reset(); } catch (e) {}
                    }
                });
            }

            // If Turnstile is configured, execute and get token
            if (TURNSTILE_SITEKEY && typeof turnstile !== 'undefined' && turnstile.execute) {
                try {
                    turnstile.execute(function (token) {
                        doSubmit(token);
                    });
                } catch (e) {
                    doSubmit('');
                }
            } else {
                doSubmit('');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
