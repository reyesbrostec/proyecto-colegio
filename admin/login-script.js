const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
// Apuntamos a la URL del servidor en producción para que coincida con el resto de la app
const API_URL = 'https://colegio-backend-6oun.onrender.com/api';

loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    errorMessage.textContent = '';

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            // Si la respuesta no es exitosa, muestra el mensaje del servidor o uno genérico.
            errorMessage.textContent = data.message || 'Error al iniciar sesión. Verifique sus credenciales.';
            throw new Error(data.message || 'Error al iniciar sesión');
        }

        sessionStorage.setItem('authToken', data.token);

        // Decodificar el token para obtener el rol del usuario
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        
        // Redirigir basado en el rol. Se usan rutas relativas para mayor flexibilidad.
        if (payload.rol === 'admin') {
            window.location.href = 'dashboard.html'; // Ya estamos en la carpeta /admin
        } else {
            window.location.href = '../plataforma-estudiantil.html'; // Subir un nivel para encontrar el archivo
        }
            
    } catch (error) {
        console.error('Error detallado:', error);
        // Si el errorMessage aún no tiene texto, es probable que sea un error de red.
        if (!errorMessage.textContent) {
            errorMessage.textContent = 'Error de red. ¿Está el servidor funcionando y accesible?';
        }
    }
});
