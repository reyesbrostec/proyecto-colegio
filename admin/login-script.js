const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const API_URL = 'http://localhost:3000/api';

loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    errorMessage.textContent = '';

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Error al iniciar sesión.');
        }

        sessionStorage.setItem('authToken', data.token);
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        sessionStorage.setItem('userRole', payload.rol);

        if (payload.rol === 'admin') {
            window.location.href = '/admin/dashboard.html';
        } else if (payload.rol === 'estudiante') {
            window.location.href = '/plataforma-estudiantil.html';
        } else {
            alert('Portal para maestros en construcción.');
            errorMessage.textContent = 'Portal para su rol no disponible aún.';
        }

    } catch (error) {
        errorMessage.textContent = error.message;
    }
});
