document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'https://colegio-backend-6oun.onrender.com/api'; // URL de producción
    const token = sessionStorage.getItem('authToken');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // ... (El resto del código es el mismo, no necesita cambios)
    const logoutBtn = document.getElementById('logout-btn');
    const createNewsForm = document.getElementById('create-news-form');
    const createUserForm = document.getElementById('create-user-form');
    const noticiasListDiv = document.getElementById('noticias-list');
    const usuariosListDiv = document.getElementById('usuarios-list');
    const allGradesContainer = document.getElementById('all-grades-container');

    async function fetchData(endpoint) {
        const response = await fetch(`${API_URL}/${endpoint}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.status === 403) {
            sessionStorage.removeItem('authToken');
            alert('Tu sesión ha expirado o no tienes permisos.');
            window.location.href = 'login.html';
        }
        return response.json();
    }

    async function postData(endpoint, data) {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errorData = await response.json();
            alert(`Error: ${errorData.message}`);
        }
        return response.ok;
    }

    async function deleteData(endpoint, id) {
        if (confirm('¿Estás seguro de que quieres eliminar este elemento?')) {
            await fetch(`${API_URL}/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return true;
        }
        return false;
    }

    function renderizarNoticias(noticias) {
        noticiasListDiv.innerHTML = '';
        noticias.forEach(noticia => {
            const item = document.createElement('div');
            item.className = 'item-admin';
            item.innerHTML = `<div><h4>${noticia.titulo}</h4><p>${noticia.contenido.substring(0, 50)}...</p></div><button class="delete-btn" data-id="${noticia.id}">Eliminar</button>`;
            noticiasListDiv.appendChild(item);
        });
    }

    function renderizarUsuarios(usuarios) {
        usuariosListDiv.innerHTML = '';
        usuarios.forEach(usuario => {
            const item = document.createElement('div');
            item.className = 'item-admin';
            item.innerHTML = `<div><h4>${usuario.nombre_completo || 'Sin nombre'} (@${usuario.username})</h4><p>${usuario.email} (${usuario.rol})</p></div>`;
            usuariosListDiv.appendChild(item);
        });
    }

    function renderizarTodasLasNotas(notas) {
        if (!notas || notas.length === 0) {
            allGradesContainer.innerHTML = '<p>No hay calificaciones para mostrar.</p>';
            return;
        }
        const notasAgrupadas = notas.reduce((acc, nota) => {
            if (!acc[nota.nombre_completo]) acc[nota.nombre_completo] = [];
            acc[nota.nombre_completo].push(nota);
            return acc;
        }, {});

        let html = '';
        for (const nombreEstudiante in notasAgrupadas) {
            html += `<h4 class="student-name-header">${nombreEstudiante}</h4>`;
            html += '<table class="grades-table"><thead><tr><th>Materia</th><th>Nota Final</th></tr></thead><tbody>';
            notasAgrupadas[nombreEstudiante].forEach(nota => {
                html += `<tr><td>${nota.materia}</td><td><b>${nota.nota_final}</b></td></tr>`;
            });
            html += '</tbody></table>';
        }
        allGradesContainer.innerHTML = html;
    }

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('authToken');
        window.location.href = 'login.html';
    });

    createNewsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const titulo = document.getElementById('create-news-title').value;
        const contenido = document.getElementById('create-news-content').value;
        const success = await postData('noticias', { titulo, contenido });
        if (success) {
            cargarContenido();
            event.target.reset();
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
        const success = await postData('usuarios', userData);
        if (success) {
            cargarContenido();
            event.target.reset();
        }
    });

    noticiasListDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const id = event.target.dataset.id;
            const success = await deleteData('noticias', id);
            if (success) cargarContenido();
        }
    });

    async function cargarContenido() {
        try {
            const [noticias, usuarios, todasLasNotas] = await Promise.all([
                fetchData('noticias'),
                fetchData('usuarios'),
                fetchData('todas-las-notas')
            ]);
            renderizarNoticias(noticias);
            renderizarUsuarios(usuarios);
            renderizarTodasLasNotas(todasLasNotas);
        } catch (error) {
            console.error('Error al cargar contenido del dashboard:', error);
        }
    }

    cargarContenido();
});
