// Espera a que todo el HTML esté cargado antes de ejecutar cualquier código
document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN Y VERIFICACIÓN INICIAL ---
    const API_URL = 'https://colegio-backend-6oun.onrender.com/api';
    const token = sessionStorage.getItem('authToken');

    if (!token) {
        alert('Acceso denegado. Por favor, inicie sesión.');
        window.location.href = 'login.html';
        return; // Detiene la ejecución si no hay token
    }

    // --- SELECCIÓN DE ELEMENTOS DEL DOM ---
    const logoutBtn = document.getElementById('logout-btn');
    const createNewsForm = document.getElementById('create-news-form');
    const createUserForm = document.getElementById('create-user-form');
    const noticiasListDiv = document.getElementById('noticias-list');
    const usuariosListDiv = document.getElementById('usuarios-list');

    // --- FUNCIONES DE API ---
    async function fetchData(endpoint) {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 403) {
            sessionStorage.removeItem('authToken');
            alert('Tu sesión ha expirado o no tienes permisos. Por favor, inicia sesión de nuevo.');
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

    // --- RENDERIZADO EN PÁGINA ---
    function renderizarNoticias(noticias) {
        noticiasListDiv.innerHTML = '';
        noticias.forEach(noticia => {
            const item = document.createElement('div');
            item.className = 'item-admin';
            item.innerHTML = `
                <div><h4>${noticia.titulo}</h4><p>${noticia.contenido.substring(0, 50)}...</p></div>
                <button class="delete-btn" data-id="${noticia.id}" data-type="noticias">Eliminar</button>
            `;
            noticiasListDiv.appendChild(item);
        });
    }

    function renderizarUsuarios(usuarios) {
        usuariosListDiv.innerHTML = '';
        usuarios.forEach(usuario => {
            const item = document.createElement('div');
            item.className = 'item-admin';
            item.innerHTML = `
                <div><h4>${usuario.nombre_completo || 'Sin nombre'} (@${usuario.username})</h4><p>${usuario.email} (${usuario.rol})</p></div>
            `;
            usuariosListDiv.appendChild(item);
        });
    }

    // --- MANEJO DE EVENTOS ---
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('authToken');
        alert('Has cerrado sesión exitosamente.');
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
        
        // Leemos todos los nuevos campos del formulario detallado
        const nombre_completo = document.getElementById('create-user-fullname').value;
        const username = document.getElementById('create-user-username').value;
        const edad = document.getElementById('create-user-age').value || null; // Enviamos null si está vacío
        const email = document.getElementById('create-user-email').value;
        const password = document.getElementById('create-user-password').value;
        const rol = document.getElementById('create-user-role').value;

        const userData = { nombre_completo, username, edad, email, password, rol };

        const success = await postData('usuarios', userData);
        if (success) {
            cargarContenido();
            event.target.reset();
        }
    });

    noticiasListDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const id = event.target.dataset.id;
            const type = event.target.dataset.type;
            const success = await deleteData(type, id);
            if (success) {
                cargarContenido();
            }
        }
    });

    // --- CARGA INICIAL ---
    async function cargarContenido() {
        try {
            const [noticias, usuarios] = await Promise.all([
                fetchData('noticias'),
                fetchData('usuarios')
            ]);
            renderizarNoticias(noticias);
            renderizarUsuarios(usuarios);
        } catch (error) {
            console.error('Error al cargar contenido del dashboard:', error);
        }
    }

    cargarContenido();
});
