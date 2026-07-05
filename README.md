# EcoValue — Capturador de Leads de Paneles Solares

Landing page para **capturar prospectos interesados en instalación de paneles
solares**, pensada como destino de un **anuncio de Facebook**. Al enviar el
formulario, el prospecto se **redirige automáticamente a WhatsApp** con todos
sus datos ya escritos. Construida con **Node.js + TypeScript + Express**.

## ✨ Qué incluye

- **Landing en español**, mobile-first, con diseño **moderno y corporativo**.
- **Envío automático a WhatsApp**: al enviar el formulario, el prospecto se
  redirige a un chat de WhatsApp con tu número (`WHATSAPP_NUMBER`) y **todos sus
  datos ya escritos** en el mensaje. Recibes el lead por WhatsApp y te queda su
  contacto para dar seguimiento.
- **Formulario de captura** con validación en cliente y servidor: nombre,
  teléfono/WhatsApp, correo, tipo de inmueble, consumo mensual y ubicación.
- **Espacio reservado para tu logo** (`public/assets/logo.png`). Mientras no lo
  agregues, se muestra un recuadro que mantiene el layout.
- **Almacenamiento de leads** en `data/leads.json` **y** `data/leads.csv`.
- **Endpoints de administración** protegidos por token para listar y exportar leads.
- **Atribución de campaña**: captura `utm_source`, `utm_campaign` y `fbclid`
  desde la URL para saber qué anuncio generó cada lead.
- **Anti-spam**: honeypot + rate limiting básico.
- **Notificación por correo con Resend**: cada lead dispara un email (con los
  datos y un botón para responder por WhatsApp) a los correos de `LEAD_NOTIFY_TO`.
- **Reenvío opcional a webhook** (CRM, Zapier, Make, Google Sheets…).
- **Meta Pixel**: dispara el evento `Lead` automáticamente si el píxel está en la página.

## 🚀 Uso rápido

```bash
npm install
cp .env.example .env      # ajusta WHATSAPP_NUMBER, ADMIN_TOKEN, etc.
npm run dev               # desarrollo con recarga automática
# o
npm run build && npm start
```

Abre <http://localhost:3000>.

## 📱 Envío a WhatsApp

Define tu número en `.env` (formato internacional, solo dígitos):

```
# +52 1 55 1059 7019  ->  5215510597019
WHATSAPP_NUMBER=5215510597019
```

Cuando alguien envía el formulario:
1. El lead se guarda en el servidor (`data/leads.json` + `.csv`).
2. El prospecto es redirigido a `https://wa.me/<tu-número>` con un mensaje
   pre-llenado que incluye nombre, teléfono, correo, tipo de inmueble, consumo
   y ubicación. Solo tiene que pulsar **Enviar** y el mensaje llega a tu WhatsApp.

> Es el patrón estándar de los anuncios "click to WhatsApp": tú recibes el
> mensaje **y** te queda el contacto del cliente para seguimiento.

## 🖼️ Agregar el logo

Coloca el logo en `public/assets/logo.png` (PNG transparente, ~480px de ancho).
Si usas otro nombre/formato, actualiza el `src` en `public/index.html`.

## 📥 Ver / exportar los leads

Define `ADMIN_TOKEN` en tu `.env` y luego:

```bash
# Listar en JSON
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3000/api/leads

# Descargar CSV (abre en Excel / Google Sheets)
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3000/api/leads.csv -o leads.csv
```

> Los archivos en `data/` están en `.gitignore` para no subir datos de clientes.

## 📣 Conectar con el anuncio de Facebook

1. Despliega el sitio en un dominio con HTTPS (Render, Railway, Fly.io, un VPS…).
2. En tu anuncio usa como URL de destino tu dominio con parámetros de campaña:
   `https://tudominio.com/?utm_source=facebook&utm_campaign=solar_verano`
3. (Opcional) Pega tu **Meta Pixel** en `<head>` de `public/index.html`;
   el formulario ya dispara el evento `Lead` al enviarse.

## ⚙️ Variables de entorno

| Variable          | Descripción                                                        |
|-------------------|--------------------------------------------------------------------|
| `PORT`            | Puerto del servidor (default 3000).                                |
| `WHATSAPP_NUMBER` | WhatsApp destino de los leads (solo dígitos, formato internacional).|
| `ALLOWED_ORIGINS` | Orígenes permitidos para CORS. `*` para cualquiera.                |
| `LEAD_WEBHOOK_URL`| Si se define, cada lead se reenvía como POST JSON a esa URL.       |
| `ADMIN_TOKEN`     | Token para los endpoints de administración. Manténlo en secreto.   |

## 📁 Estructura

```
src/
  server.ts      Servidor Express, rutas y middleware
  store.ts       Persistencia en JSON + CSV
  validate.ts    Validación y normalización del formulario
  types.ts       Tipos de TypeScript
public/
  index.html     Landing + formulario
  styles.css     Estilos (paleta corporativa EcoValue)
  app.js         Envío del formulario, atribución y redirección a WhatsApp
  privacy.html   Aviso de privacidad (edítalo)
  assets/        Aquí va tu logo.png
data/             Leads capturados (ignorado por git)
```
