# WORKFLOW GIT — Proyecto Colegio U.E.P. Aurelio Mosquera

## ⚠️ REGLA DE ORO
**SIEMPRE hacer `git pull` antes de empezar a trabajar y SIEMPRE hacer `git push` al terminar.**

Dos máquinas trabajan en este mismo proyecto. Si no sincronizas, vas a causar conflictos.

---

## 📋 Flujo diario (OBLIGATORIO)

```bash
# 1. ANTES de tocar cualquier archivo
cd ~/proyectos-colegio/proyecto-colegio
git pull origin main

# 2. TRABAJAR normalmente...

# 3. DESPUÉS de terminar
git add -A
git commit -m "descripción de lo que hiciste"
git pull origin main   # ← POR SI ALGUIEN MÁS SUBIÓ ALGO
git push origin main
```

---

## 🔥 Si hay conflictos (NO PANIC)

```bash
# Ver qué archivos tienen conflicto
git status

# Resolver manualmente (buscar <<<<<<<, =======, >>>>>>>)
# Luego:
git add archivo_resuelto
git commit -m "merge: resolver conflictos"
git push origin main
```

---

## 📊 Estructura del proyecto

```
proyecto-colegio/
├── api/              → Serverless functions de Vercel (api/notas.js, api/usuarios.js, etc.)
├── routes/           → Rutas Express (para desarrollo local)
├── public/           → Frontend HTML/CSS/JS
├── middleware/       → Auth middleware (JWT)
├── db.js            → Pool de PostgreSQL
├── migrate.js       → Migraciones automáticas al iniciar
├── server.js        → Express server (desarrollo local)
├── vercel.json      → Config de Vercel
└── .env             → Variables de entorno (NO SUBIR A GIT)
```

---

## 🔑 Credenciales (NO CAMBIAR SIN AVISAR)

| Rol        | Email                      | Password       |
|------------|----------------------------|----------------|
| Admin      | admin@colegio.com          | admin477       |
| Secretaria | secretaria@colegio.com     | secretaria123  |
| Docente    | ns@colegio.com             | docente123     |
| Docente    | docente@colegio.com        | docente123     |

---

## 🗄️ Base de datos

- **Proveedor**: Neon PostgreSQL
- **Connection string**: ⚠️ **NO GUARDAR AQUÍ** — usar `process.env.DATABASE_URL` en `.env` local y en variables de entorno de Vercel/Render
- **Tablas**: usuarios, noticias, notas, galeria, cursos, grados, asignaturas, asignatura_grado, config_calificaciones, docente_asignacion, estudiantes_curso, calificaciones

---

## 🚀 Deploy

```bash
# Push + deploy automático
git push origin main

# O manual
vercel --prod --yes
```

- **URL producción**: https://proyecto-colegio.vercel.app
- **Vercel project**: reyesbr0ss-projects/proyecto-colegio

---

## 📝 Última consolidación

**Fecha**: Julio 2026  
**Commits fusionados**: 18 commits de otra máquina + cambios locales  
**Resuelto**: 
- ✅ Admin login (admin477)
- ✅ Secretaria permisos (isEditor)
- ✅ Docente crash (sessionStorage fix)
- ✅ WhatsApp button + logo U.E.P. Aurelio Mosquera
- ✅ Tablas de calificaciones (8 nuevas)
- ✅ Seed data (30 estudiantes, 9 materias, Nestor→Matemática)
