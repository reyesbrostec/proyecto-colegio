document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN Y VERIFICACIÓN INICIAL ---
    const API_URL = 'https://colegio-backend-6oun.onrender.com/api';
    const token = sessionStorage.getItem('authToken');

    // 1. Verificación de Token
    if (!token) {
        alert('Acceso denegado. Por favor, inicie sesión.');
        window.location.href = '../admin/login.html';
        return;
    }

    // 2. Verificación de Rol (¡MUY IMPORTANTE!)
    // Decodificamos el token para asegurarnos de que el rol es 'docente' o 'admin'.
    // Un usuario malintencionado podría intentar acceder a esta URL directamente.
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.rol !== 'docente' && payload.rol !== 'admin') { // Permitimos admin por conveniencia
            alert('Acceso no autorizado para este rol.');
            window.location.href = '../index.html';
            return;
        }
    } catch (e) {
        console.error('Token inválido:', e);
        alert('Su sesión es inválida. Por favor, inicie sesión de nuevo.');
        sessionStorage.removeItem('authToken');
        window.location.href = '../admin/login.html';
        return;
    }

    // --- SELECCIÓN DE ELEMENTOS DEL DOM ---
    const logoutBtn = document.getElementById('logout-btn');
    const allGradesContainer = document.getElementById('all-grades-container');
    const searchGradesInput = document.getElementById('search-grades');
    const toast = document.getElementById('toast-notification');
    let todasLasNotasOriginales = []; // Para guardar la lista completa y permitir filtrar

    // --- FUNCIONES DE API (Reutilizadas y mejoradas) ---
    async function handleApiResponse(response) {
        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem('authToken');
            alert('Tu sesión ha expirado o no tienes permisos. Por favor, inicia sesión de nuevo.');
            window.location.href = '../admin/login.html';
            throw new Error('Sesión inválida');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message || 'Ocurrió un error en la solicitud.');
        }
        return response.json();
    }

    async function fetchData(endpoint) {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return handleApiResponse(response);
    }

    async function updateData(endpoint, id, data) {
        const response = await fetch(`${API_URL}/${endpoint}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        return handleApiResponse(response);
    }

    // --- RENDERIZADO EN PÁGINA ---
    function showToast(message, isError = false) {
        toast.textContent = message;
        toast.style.backgroundColor = isError ? 'var(--danger-color)' : '#28a745';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function renderizarTodasLasNotas(notas) {
        if (!notas || notas.length === 0) {
            allGradesContainer.innerHTML = '<p>No hay calificaciones para mostrar.</p>';
            return;
        }
        const notasAgrupadas = notas.filter(nota => nota.nombre_completo).reduce((acc, nota) => {
            if (!acc[nota.nombre_completo]) acc[nota.nombre_completo] = [];
            acc[nota.nombre_completo].push(nota);
            return acc;
        }, {});

        let html = '';
        for (const nombreEstudiante in notasAgrupadas) {
            html += `<h4 class="student-name-header">${nombreEstudiante}</h4>`;
            html += `<table class="grades-table"><thead><tr><th>Materia</th><th>Parcial 1</th><th>Parcial 2</th><th>Examen Final</th><th>Nota Final</th><th>Acción</th><th>Última Edición</th></tr></thead><tbody>`;
            notasAgrupadas[nombreEstudiante].forEach(nota => {
                const fechaEdicion = nota.fecha_edicion ? new Date(nota.fecha_edicion).toLocaleString('es-ES') : 'N/A';
                const editor = nota.editado_por || '';
                html += `<tr data-nota-id="${nota.id}">
                        <td>${nota.materia}</td>
                        <td><input type="number" class="grade-input" name="parcial1" value="${nota.parcial1 || 0}" min="0" max="10" step="0.01"></td>
                        <td><input type="number" class="grade-input" name="parcial2" value="${nota.parcial2 || 0}" min="0" max="10" step="0.01"></td>
                        <td><input type="number" class="grade-input" name="examen_final" value="${nota.examen_final || 0}" min="0" max="10" step="0.01"></td>
                        <td class="nota-final-cell"><b>${nota.nota_final || 0}</b></td>
                        <td><button class="save-btn" data-id="${nota.id}">Guardar</button></td>
                        <td class="editor-cell" title="Editado por ${editor}">${editor.split('@')[0]}<br><small>${fechaEdicion}</small></td>
                    </tr>`;
            });
            html += '</tbody></table>';
        }
        allGradesContainer.innerHTML = html;
    }

    // --- MANEJO DE EVENTOS ---
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('authToken');
        window.location.href = '../index.html';
    });

    allGradesContainer.addEventListener('click', async (event) => {
        if (event.target.classList.contains('save-btn')) {
            const notaId = event.target.dataset.id;
            const row = event.target.closest('tr');
            const updatedGradeData = {
                parcial1: row.querySelector('input[name="parcial1"]').value,
                parcial2: row.querySelector('input[name="parcial2"]').value,
                examen_final: row.querySelector('input[name="examen_final"]').value
            };
            try {
                const updatedNota = await updateData('notas', notaId, updatedGradeData);
                row.querySelector('.nota-final-cell b').textContent = updatedNota.nota_final;
                const editorCell = row.querySelector('.editor-cell');
                const fechaEdicion = new Date(updatedNota.fecha_edicion).toLocaleString('es-ES');
                editorCell.innerHTML = `${updatedNota.editado_por.split('@')[0]}<br><small>${fechaEdicion}</small>`;
                editorCell.title = `Editado por ${updatedNota.editado_por}`;
                showToast('Calificación guardada con éxito.');
            } catch (error) {
                showToast(`Error: ${error.message}`, true);
            }
        }
    });

    searchGradesInput.addEventListener('input', () => {
        const searchTerm = searchGradesInput.value.toLowerCase().trim();
        const notasFiltradas = todasLasNotasOriginales.filter(nota => nota.nombre_completo.toLowerCase().includes(searchTerm));
        renderizarTodasLasNotas(notasFiltradas);
    });

    // --- CARGA INICIAL ---
    async function cargarContenido() {
        try {
            const todasLasNotas = await fetchData('notas/todas-las-notas');
            todasLasNotasOriginales = todasLasNotas;
            renderizarTodasLasNotas(todasLasNotas);
        } catch (error) {
            console.error('Error al cargar contenido del dashboard:', error);
        }
    }

    cargarContenido();
});