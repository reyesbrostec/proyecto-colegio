﻿﻿﻿document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN Y VERIFICACIÓN INICIAL ---
    // Apuntamos a la URL del servidor en producción
    const API_URL = 'https://colegio-backend-6oun.onrender.com/api';
    const token = sessionStorage.getItem('authToken');

    // Si no hay token guardado, no se puede acceder a esta página
    if (!token) {
        alert('Acceso denegado. Por favor, inicie sesión.');
        window.location.href = 'login.html';
        return; // Detiene la ejecución del resto del script
    }

    // --- SELECCIÓN DE ELEMENTOS DEL DOM ---
    const logoutBtn = document.getElementById('logout-btn');
    const createNewsForm = document.getElementById('create-news-form');
    const createUserForm = document.getElementById('create-user-form');
    const noticiasListDiv = document.getElementById('noticias-list');
    const usuariosListDiv = document.getElementById('usuarios-list');
    const editUserModal = document.getElementById('edit-user-modal'); // Modal para editar
    const closeModalBtn = editUserModal.querySelector('.close-btn');
    const allGradesContainer = document.getElementById('all-grades-container');
    const searchGradesInput = document.getElementById('search-grades');
    const toast = document.getElementById('toast-notification');
    let todasLasNotasOriginales = []; // Para guardar la lista completa y permitir filtrar

    // --- FUNCIONES DE API ---
    async function fetchData(endpoint) {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 403) { // Maneja el caso de token expirado o inválido
            sessionStorage.removeItem('authToken');
            alert('Tu sesión ha expirado o no tienes permisos. Por favor, inicia sesión de nuevo.');
            window.location.href = 'login.html';
            // Lanzamos un error para detener la ejecución en Promise.all
            throw new Error('Sesión inválida, redireccionando...');
        }
        if (!response.ok) {
            // Intentamos obtener un mensaje del cuerpo, si no, usamos el texto de estado
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message || 'Error al obtener los datos');
        }
        return response.json();
    }

    async function postData(endpoint, data) {
        const response = await fetch(`${API_URL}/${endpoint}`, { // Corregido: se añade /
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const responseData = await response.json().catch(() => ({})); // Evita error si no hay body
        if (!response.ok) {
            throw new Error(responseData.message || 'Error al crear el elemento.');
        }
        return responseData;
    }

    async function updateData(endpoint, id, data) {
        const response = await fetch(`${API_URL}/${endpoint}/${id}`, { // Corregido: se añade /
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(responseData.message || 'Error al actualizar el elemento.');
        }
        return responseData;
    }

    async function deleteData(endpoint, id) {
        // La confirmación ahora se maneja en el event listener para no mezclar lógica.
        const response = await fetch(`${API_URL}/${endpoint}/${id}`, { // Corregido: se añade /
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // DELETE puede devolver 204 No Content, que no tiene JSON.
        // `response.ok` es suficiente para saber si fue exitoso.
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Error al eliminar el elemento.');
        }
        // No es necesario devolver nada en caso de éxito.
    }

    // --- RENDERIZADO EN PÁGINA ---
    function renderizarNoticias(noticias) {
        noticiasListDiv.innerHTML = '';
        noticias.forEach(noticia => {
            const item = document.createElement('div');
            item.className = 'item-admin';
            item.innerHTML = `
                <div><h4>${noticia.titulo}</h4><p>${noticia.contenido.substring(0, 50)}...</p></div>
                <button class="delete-btn" data-id="${noticia.id}">Eliminar</button>
            `;
            noticiasListDiv.appendChild(item);
        });
    }

    function renderizarUsuarios(usuarios) {
        usuariosListDiv.innerHTML = '';
        const template = document.getElementById('user-item-template');

        usuarios.forEach(usuario => {
            const userClone = template.content.cloneNode(true);
            
            userClone.querySelector('.user-fullname').textContent = `${usuario.nombre_completo || 'Sin nombre'} (@${usuario.username})`;
            userClone.querySelector('.user-details').textContent = `${usuario.email} (Rol: ${usuario.rol})`;
            
            const editBtn = userClone.querySelector('.edit-user-btn');
            const deleteBtn = userClone.querySelector('.delete-user-btn');
            editBtn.dataset.id = usuario.id;
            deleteBtn.dataset.id = usuario.id;
            usuariosListDiv.appendChild(userClone);
        });
    }

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
        // Agrupar notas por estudiante
        const notasAgrupadas = notas.reduce((acc, nota) => {
            if (!acc[nota.nombre_completo]) acc[nota.nombre_completo] = [];
            acc[nota.nombre_completo].push(nota);
            return acc;
        }, {});

        // Construir el HTML de las tablas editables
        let html = '';
        for (const nombreEstudiante in notasAgrupadas) {
            html += `<h4 class="student-name-header">${nombreEstudiante}</h4>`;
            html += `
                <table class="grades-table">
                    <thead>
                        <tr>
                            <th>Materia</th>
                            <th>Parcial 1</th>
                            <th>Parcial 2</th>
                            <th>Examen Final</th>
                            <th>Nota Final</th>
                            <th>Acción</th>
                            <th>Última Edición</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            notasAgrupadas[nombreEstudiante].forEach(nota => {
                const fechaEdicion = nota.fecha_edicion ? new Date(nota.fecha_edicion).toLocaleString('es-ES') : 'N/A';
                const editor = nota.editado_por || '';
                html += `
                    <tr data-nota-id="${nota.id}">
                        <td>${nota.materia}</td>
                        <td><input type="number" class="grade-input" name="parcial1" value="${nota.parcial1 || 0}" min="0" max="10" step="0.01"></td>
                        <td><input type="number" class="grade-input" name="parcial2" value="${nota.parcial2 || 0}" min="0" max="10" step="0.01"></td>
                        <td><input type="number" class="grade-input" name="examen_final" value="${nota.examen_final || 0}" min="0" max="10" step="0.01"></td>
                        <td class="nota-final-cell"><b>${nota.nota_final || 0}</b></td>
                        <td><button class="save-btn" data-id="${nota.id}">Guardar</button></td>
                        <td class="editor-cell">${editor}<br>${fechaEdicion}</td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
        }
        allGradesContainer.innerHTML = html;
    }

    // --- BÚSQUEDA DE CALIFICACIONES ---
    function filtrarCalificaciones() {
        const searchTerm = searchGradesInput.value.toLowerCase().trim();

        // Filtramos el array original de notas. La función de renderizado se encargará de agrupar.
        const notasFiltradas = todasLasNotasOriginales.filter(nota =>
            nota.nombre_completo.toLowerCase().includes(searchTerm)
        );

        renderizarTodasLasNotas(notasFiltradas);
    }


    // --- MANEJO DE EVENTOS ---
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('authToken');
        // Redirigir a la página de inicio principal del sitio
        window.location.href = '../index.html';
    });

    createNewsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const titulo = document.getElementById('create-news-title').value;
        const contenido = document.getElementById('create-news-content').value;
        try {
            await postData('noticias', { titulo, contenido });
            showToast('Noticia creada con éxito.');
            cargarContenido();
            event.target.reset();
        } catch (error) {
            showToast(error.message, true);
        }
    });

    // Event listener para guardar calificaciones desde la tabla
    allGradesContainer.addEventListener('click', async (event) => {
        if (event.target.classList.contains('save-btn')) {
            const notaId = event.target.dataset.id;
            const row = event.target.closest('tr');

            const updatedGradeData = {
                parcial1: row.querySelector('input[name="parcial1"]').value,
                parcial2: row.querySelector('input[name="parcial2"]').value,
                examen_final: row.querySelector('input[name="examen_final"]').value
            };

            // Usamos fetch directamente para tener más control sobre la respuesta y la UX
            try {
                const response = await fetch(`${API_URL}/notas/${notaId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(updatedGradeData)
                });

                if (response.ok) {
                    const updatedNota = await response.json();
                    // Actualizamos la fila específica sin recargar todo para una mejor experiencia
                    row.querySelector('.nota-final-cell b').textContent = updatedNota.nota_final;
                    const editorCell = row.querySelector('.editor-cell');
                    const fechaEdicion = new Date(updatedNota.fecha_edicion).toLocaleString('es-ES');
                    editorCell.innerHTML = `${updatedNota.editado_por}<br>${fechaEdicion}`;
                    showToast('Calificación guardada con éxito.');
                } else {
                    const errorData = await response.json();
                    showToast(`Error: ${errorData.message}`, true);
                }
            } catch (error) {
                showToast('Error de red al guardar la calificación.', true);
            }
        }
    });

    createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userData = {
            nombre_completo: document.getElementById('create-user-fullname').value,
            username: document.getElementById('create-user-username').value,
            edad: document.getElementById('create-user-age').value || null,
            email: document.getElementById('create-user-email').value,
            password: document.getElementById('create-user-password').value,
            rol: document.getElementById('create-user-role').value
        };
        try {
            await postData('usuarios', userData);
            showToast('Usuario creado con éxito.');
            cargarContenido();
            event.target.reset();
        } catch (error) {
            showToast(error.message, true);
        }
    });

    noticiasListDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar esta noticia?')) {
                const id = event.target.dataset.id;
                try {
                    await deleteData('noticias', id);
                    showToast('Noticia eliminada.');
                    cargarContenido();
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        }
    });

    // Event listener para los botones de la lista de usuarios (editar/eliminar)
    usuariosListDiv.addEventListener('click', async (event) => {
        const target = event.target;
        // --- Lógica para Eliminar Usuario (movida para usar showToast) ---
        if (target.classList.contains('delete-user-btn')) {
            const id = target.dataset.id;
            const success = await deleteData('usuarios', id);
            if (success) {
                alert('Usuario eliminado correctamente.');
                cargarContenido(); // Recargamos la lista
            }
            if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
                const id = target.dataset.id;
                try {
                    await deleteData('usuarios', id);
                    showToast('Usuario eliminado correctamente.');
                    cargarContenido();
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        }

        // --- Lógica para Editar Usuario ---
        if (target.classList.contains('edit-user-btn')) {
            const id = target.dataset.id;
            const userData = await fetchData(`usuarios/${id}`); // Necesitas un endpoint en tu API que devuelva un solo usuario
            if (userData) {
                // Llenamos el formulario del modal con los datos del usuario
                document.getElementById('edit-user-id').value = userData.id;
                document.getElementById('edit-user-fullname').value = userData.nombre_completo;
                document.getElementById('edit-user-username').value = userData.username;
                document.getElementById('edit-user-email').value = userData.email;
                document.getElementById('edit-user-age').value = userData.edad || ''; // Añadimos la edad
                document.getElementById('edit-user-role').value = userData.rol;
                editUserModal.style.display = 'block'; // Mostramos el modal
            }
        }
    });

    // Event listener para el formulario de edición dentro del modal
    document.getElementById('edit-user-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const updatedData = {
            nombre_completo: document.getElementById('edit-user-fullname').value,
            username: document.getElementById('edit-user-username').value,
            email: document.getElementById('edit-user-email').value,
            edad: document.getElementById('edit-user-age').value || null, // Añadimos la edad
            rol: document.getElementById('edit-user-role').value
        };

        try {
            await updateData('usuarios', id, updatedData);
            showToast('Usuario actualizado correctamente.');
            editUserModal.style.display = 'none'; // Ocultamos el modal
            cargarContenido(); // Recargamos la lista
        } catch (error) {
            // Mostramos el error sin cerrar el modal para que el usuario pueda corregir
            showToast(error.message, true);
        }
    });

    // --- Manejo del Modal ---
    closeModalBtn.addEventListener('click', () => {
        editUserModal.style.display = 'none';
    });

    // Event listener para la barra de búsqueda de calificaciones
    searchGradesInput.addEventListener('input', filtrarCalificaciones);

    // --- CARGA INICIAL ---
    async function cargarContenido() {
        try {
            const [noticias, usuarios, todasLasNotas] = await Promise.all([
                fetchData('noticias'),
                fetchData('usuarios'),
                fetchData('notas/todas-las-notas')
            ]);
            todasLasNotasOriginales = todasLasNotas; // Guardamos la lista original para poder filtrar
            renderizarNoticias(noticias);
            renderizarUsuarios(usuarios);
            renderizarTodasLasNotas(todasLasNotas);
        } catch (error) {
            console.error('Error al cargar contenido del dashboard:', error);
        }
    }

    cargarContenido();
});
