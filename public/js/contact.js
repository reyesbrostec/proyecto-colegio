/* contact.js — Validación del formulario de contacto
   - Validación en tiempo real (blur)
   - Resumen de errores con enlaces a campos
   - Envío a Formspree o FormSubmit
   - Feedback accesible con aria-invalid y aria-describedby
   ========================================================================== */

(function () {
    'use strict';

    // Configuración — cambiar FORMSPREE_ID por tu ID real de Formspree
    var FORMSPREE_ID = 'TU_CODIGO_UNICO';

    function getFormspreeEndpoint() {
        var meta = document.querySelector('meta[name="contact:formspree"]');
        if (meta) return meta.getAttribute('content');
        if (FORMSPREE_ID && FORMSPREE_ID !== 'TU_CODIGO_UNICO') {
            return 'https://formspree.io/f/' + FORMSPREE_ID;
        }
        return '';
    }

    function getContactEmail() {
        var meta = document.querySelector('meta[name="contact:email"]');
        return meta ? meta.getAttribute('content') : '';
    }

    function validEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
        if (!value) {
            return { id: id, message: 'Este campo es obligatorio.' };
        }
        if (field.type === 'email' && !validEmail(value)) {
            return { id: id, message: 'Ingresa un correo electrónico válido.' };
        }
        if (id === 'message' && value.length < 10) {
            return { id: id, message: 'El mensaje debe tener al menos 10 caracteres.' };
        }
        if (id === 'name' && value.length < 2) {
            return { id: id, message: 'El nombre debe tener al menos 2 caracteres.' };
        }
        return null;
    }

    // ── Validar formulario completo ──
    function validateForm(form) {
        var fields = form.querySelectorAll('input[required], textarea[required]');
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

            var errors = validateForm(form);
            if (errors.length > 0) {
                showErrorSummary(errors, form);
                return;
            }

            var payload = {
                nombre: form.querySelector('#name').value.trim(),
                email: form.querySelector('#email').value.trim(),
                asunto: form.querySelector('#subject') ? form.querySelector('#subject').value.trim() : '',
                mensaje: form.querySelector('#message').value.trim(),
                page: location.pathname
            };

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando…';
            }

            var formspreeEndpoint = getFormspreeEndpoint();
            var contactEmail = getContactEmail();

            var sendPromise;
            if (formspreeEndpoint) {
                sendPromise = fetch(formspreeEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else if (contactEmail) {
                var formsubmitUrl = 'https://formsubmit.co/ajax/' + encodeURIComponent(contactEmail);
                sendPromise = fetch(formsubmitUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        name: payload.nombre,
                        email: payload.email,
                        message: payload.mensaje,
                        page: payload.page,
                        _subject: 'Nuevo contacto desde Colegio UEPAM',
                        _template: 'table',
                        _captcha: 'false'
                    })
                });
            } else {
                // Fallback: simular envío (demo)
                sendPromise = new Promise(function (resolve) {
                    setTimeout(function () { resolve({ ok: true }); }, 800);
                });
            }

            sendPromise.then(function (res) {
                if (!res.ok) throw new Error('Error del servidor');
                showSuccess(form, '¡Mensaje enviado con éxito! Nos pondremos en contacto pronto.');
            }).catch(function (err) {
                var errorMsg = err.message === 'Error del servidor'
                    ? 'Hubo un problema al enviar tu mensaje. Intenta de nuevo más tarde.'
                    : 'No se pudo conectar con el servidor. Verifica tu conexión.';
                showErrorSummary([{ id: 'name', message: errorMsg }], form);
            }).finally(function () {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Enviar Mensaje';
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
