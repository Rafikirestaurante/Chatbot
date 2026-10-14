# Guía de Despliegue 100% Gratuito — Rafiki Chatbot 0.5.0 (Vercel + Gemini Free Tier + Firebase Spark)

Esta versión está diseñada para que puedas alojar el proyecto en **Vercel** (donde ya tienes tu cuenta conectada con GitHub) y usar la **IA de Gemini** y la base de datos de **Firebase** en sus planes gratuitos (**$0 USD/mes**, sin necesidad de activar el plan Blaze de pago).

## Paso 1: Obtener tu clave gratuita de Gemini (`GEMINI_API_KEY`)

1. Ingresa a **[Google AI Studio](https://ai.google.dev/aistudio)** con tu cuenta de Google.
2. Haz clic en **Get API key** -> **Create API key**.
3. **Regla de oro para no pagar nunca**: Elige o crea un proyecto de Google Cloud que **NO tenga cuenta de facturación (tarjeta) vinculada**. Así tu clave permanece fija en el **Free Tier ($0 USD)** usando `gemini-3.5-flash-lite` y `gemini-2.5-flash`.
4. Copia la clave generada (`AIzaSy...`).

## Paso 2: Crear o conectar Firebase en Plan Spark (Gratuito, sin tarjeta)

*(Si prefieres probar primero sin Firebase, deja `VITE_DEMO_MODE=true` en Vercel y salta directo al Paso 3).*

1. Entra a **[Firebase Console](https://console.firebase.google.com/)** y crea un proyecto nuevo en el **Plan Spark (Gratuito)** (no actives el plan Blaze).
2. En **Build > Authentication**, habilita **Google** y **Email/Password**. En *Settings > Authorized domains*, agrega el dominio `.vercel.app` de tu proyecto.
3. En **Build > Firestore Database**, crea la base de datos en modo producción y pega el contenido del archivo `firestore.rules` en la pestaña **Rules** -> **Publish**.
4. En **Project Settings > General**, registra una **Web App (`</>`)** y copia los 6 valores `VITE_FIREBASE_*`.

## Paso 3: Desplegar en Vercel con tu repositorio de GitHub

1. Sube el contenido de esta carpeta `rafiki-chatbot-0.5.0` a tu repositorio `Rafikirestaurante/Chatbot` en GitHub.
2. En **Vercel**, abre tu proyecto `rafiki-chatbot` y ve a **Settings > Environment Variables**.
3. Agrega estas variables:
   - `GEMINI_API_KEY` = *(tu clave de Google AI Studio)*
   - `GEMINI_MODEL` = `gemini-3.5-flash-lite`
   - `VITE_DEMO_MODE` = `false` *(o `true` si quieres usar almacenamiento local en el navegador)*
   - `VITE_ADMIN_EMAIL` = `rafiki.restaurante@gmail.com`
   - *(Y las 6 variables `VITE_FIREBASE_*` si pusiste `VITE_DEMO_MODE=false`)*
4. Haz clic en **Deployments > Redeploy**.
   - El archivo `vercel.json` incluido publicará tanto la PWA como la función Serverless `/api/gemini` automáticamente.
