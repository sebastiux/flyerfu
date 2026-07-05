# 🚀 Desplegar en Railway

Guía paso a paso para publicar el capturador de leads en
[Railway](https://railway.app). Al terminar tendrás una URL con HTTPS lista
para usar como destino de tu anuncio de Facebook.

---

## 1. Sube el proyecto a GitHub

Asegúrate de que tu rama esté en GitHub (ya lo está si seguiste los pasos
anteriores). Railway se conecta directo a tu repositorio.

## 2. Crea el proyecto en Railway

1. Entra a <https://railway.app> e inicia sesión con GitHub.
2. **New Project → Deploy from GitHub repo**.
3. Elige el repositorio **`sebastiux/flyerfu`**.
4. En la rama, selecciona `main` (o la rama que quieras desplegar).

Railway detecta automáticamente que es un proyecto Node.js y usa la
configuración de `railway.json`:
- **Build:** `npm run build` (compila TypeScript a `dist/`)
- **Start:** `npm start` (arranca el servidor)
- **Health check:** `/health`

## 3. Configura las variables de entorno

En el servicio, ve a la pestaña **Variables** y agrega:

| Variable          | Valor                          | ¿Para qué?                                   |
|-------------------|--------------------------------|----------------------------------------------|
| `WHATSAPP_NUMBER` | `5215510597019`                | WhatsApp destino de los leads.               |
| `ADMIN_TOKEN`     | *(una contraseña larga)*       | Para consultar/exportar los leads.           |
| `DATA_DIR`        | `/app/data`                    | Carpeta de datos (ver paso 4).               |
| `ALLOWED_ORIGINS` | `*`                            | Orígenes CORS (déjalo en `*` si tienes dudas).|
| `RESEND_API_KEY`  | `re_...`                       | Notificación por correo (ver paso 3.1).      |
| `LEAD_NOTIFY_TO`  | `ventas@ecovalue.mx`           | Correos que reciben los leads (coma para varios).|
| `RESEND_FROM`     | `EcoValue Leads <no-reply@tudominio.com>` | Remitente verificado en Resend.  |

> **No** necesitas definir `PORT`: Railway lo asigna solo y el servidor ya lo
> respeta.

### 3.1. Notificaciones por correo con Resend

Cada vez que alguien llena el formulario, además del WhatsApp se envía un
correo con los datos del lead a las direcciones de `LEAD_NOTIFY_TO`.

1. Crea una cuenta en <https://resend.com> (tiene plan gratis).
2. **API Keys → Create API Key** → copia la clave (`re_...`) en `RESEND_API_KEY`.
3. En `LEAD_NOTIFY_TO` pon los correos que deben recibir los leads (separados
   por coma para varios, ej. `ventas@ecovalue.mx,gerencia@ecovalue.mx`).
4. **Remitente (`RESEND_FROM`):**
   - Para **producción**: en Resend ve a **Domains**, agrega y verifica tu
     dominio (`ecovalue.mx`), y usa algo como `EcoValue <no-reply@ecovalue.mx>`.
   - Para **probar rápido**: puedes dejar `RESEND_FROM` sin definir; se usa el
     remitente de pruebas de Resend (`onboarding@resend.dev`).

Si dejas `RESEND_API_KEY` vacío, el envío por correo simplemente se desactiva
(el resto sigue funcionando igual).

## 4. (Recomendado) Agrega un volumen para no perder los leads

El sistema de archivos de Railway es **efímero**: si no usas un volumen, el
archivo `leads.json`/`.csv` se **borra en cada redeploy**. (Tus leads siguen
llegando por WhatsApp, pero el historial descargable se reiniciaría.)

1. En el servicio: **Settings → Volumes → New Volume**.
2. **Mount path:** `/app/data`
3. Deja `DATA_DIR=/app/data` (paso 3) para que el servidor escriba ahí.

## 5. Genera el dominio público

1. **Settings → Networking → Generate Domain**.
2. Railway te da una URL tipo `https://flyerfu-production.up.railway.app`.

¡Listo! Abre esa URL y verás tu landing.

## 6. Conéctalo al anuncio de Facebook

Usa la URL de Railway como destino, con parámetros de campaña para saber qué
anuncio genera cada lead:

```
https://TU-DOMINIO.up.railway.app/?utm_source=facebook&utm_campaign=solar_cfe
```

---

## Ver / descargar los leads en producción

```bash
# Reemplaza el dominio y el token por los tuyos
curl -H "Authorization: Bearer TU_ADMIN_TOKEN" \
  https://TU-DOMINIO.up.railway.app/api/leads.csv -o leads.csv
```

O en el navegador:
`https://TU-DOMINIO.up.railway.app/api/leads.csv?token=TU_ADMIN_TOKEN`

---

## Solución de problemas

- **El deploy falla en el build:** revisa que Railway esté usando Node 20+
  (lo fija `.nvmrc` y `engines` en `package.json`).
- **La página carga pero el logo no aparece:** confirma que subiste
  `public/assets/logo.png` al repositorio.
- **Perdí los leads tras un redeploy:** falta el volumen (paso 4).
- **CORS / no envía el formulario:** revisa `ALLOWED_ORIGINS`.
