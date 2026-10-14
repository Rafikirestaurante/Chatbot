# Informe de validación — Rafiki Recordatorios 0.5.0 (Híbrido Gemini + Vercel)

Fecha: 14 de octubre de 2026

## Resultado general

**Aprobado para despliegue gratuito en Vercel (Plan Hobby) + Google AI Studio (Free Tier) + Firebase (Plan Spark).**

## Cambios verificados en 0.5.0

1. **Motor Híbrido (`src/agent/geminiFallback.ts`)**:
   - Ejecuta primero `processAgentMessage` (`Rafiki Agent Core`) en 0 ms para ahorrar cuota gratuita.
   - Invoca `/api/gemini` únicamente cuando `intent === "unknown"` o `confidence < 0.78` (siempre que `useGeminiFallback` esté activo en las preferencias del usuario).
   - Incluye respaldo directo a `Rafiki Agent Core` si no hay conexión o si aún no se ha configurado `GEMINI_API_KEY`.
2. **Endpoint Serverless en Vercel (`api/gemini.ts` + `vercel.json`)**:
   - Utiliza `fetch` nativo de Node sin dependencias externas para evitar errores de instalación en Vercel.
   - Solicita salida JSON estructurada (`responseMimeType: "application/json"`, `responseSchema`) al modelo `gemini-3.5-flash-lite` con respaldo automático a `gemini-2.5-flash`.
3. **Corrección del error de build en Vercel**:
   - Se corrigió `tsconfig.node.json` (`noEmit: true`), `vite.config.ts` (`loadEnv(mode, ".", "")` sin requerir `@types/node`) y `package.json` (`tsc -p tsconfig.app.json --noEmit && vite build`).
4. **Compatibilidad con Firebase Plan Spark (sin Plan Blaze)**:
   - `src/services/data.ts` y `firestore.rules` permiten registrar e iniciar sesión directamente con Firebase Auth + Firestore cuando Cloud Functions no está desplegado.
