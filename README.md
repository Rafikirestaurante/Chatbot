# Rafiki Recordatorios — 0.5.0

**Fase 2C — Arquitectura Híbrida: Rafiki Agent Core + Gemini API (Free Tier) + Vercel**

PWA multiusuario con interfaz tipo chat y motor híbrido de recordatorios:
1. **Rafiki Agent Core (Local, 0 ms, $0 USD)**: Resuelve instantáneamente en TypeScript las instrucciones directas de creación, consulta, posposición, reprogramación, finalización y cancelación sin gastar cuota de IA.
2. **Respaldo Inteligente con Gemini API (Free Tier de Google AI Studio)**: Cuando el usuario escribe una frase compleja, conversacional o con baja confianza en el motor local, delega automáticamente a `/api/gemini` (`gemini-3.5-flash-lite` / `gemini-2.5-flash`) con salida estructurada JSON para interpretar la acción o conversar naturalmente.

## Por qué alojarlo en Vercel + Firebase Spark + Google AI Studio (Costo $0 USD)

- **Vercel (Plan Hobby Gratuito, sin tarjeta)**: Aloja el frontend PWA y la función Serverless `/api/gemini.ts` que mantiene tu `GEMINI_API_KEY` oculta en el servidor.
- **Google AI Studio (Free Tier Gratuito, sin tarjeta)**: Usando una `GEMINI_API_KEY` creada en un proyecto sin facturación vinculada, los tokens de entrada y salida en `gemini-3.5-flash-lite` y `gemini-2.5-flash` cuestan **$0 USD**.
- **Firebase (Plan Spark Gratuito, sin tarjeta)**: En la versión `0.5.0`, el registro de usuario y las reglas de `firestore.rules` funcionan directamente sobre Authentication + Firestore sin obligarte a activar Cloud Functions ni el plan de pago Blaze.

## Arquitectura híbrida del agente

```text
Mensaje del usuario
  ↓
1. Rafiki Agent Core (Local en TypeScript · 0 ms · $0)
  ├── ¿Intención clara y confianza ≥ 0.78? ──► Ejecuta acción al instante
  └── ¿Intención 'unknown' o baja confianza?
        ↓
2. Respaldo Gemini API (/api/gemini en Vercel · Free Tier)
  ├── Interpreta lenguaje natural libre y devuelve JSON estructurado
  └── Si no hay internet o se alcanza el límite por minuto, responde con el respaldo local
```

## Despliegue rápido en Vercel

1. Sube esta carpeta a tu repositorio `Rafikirestaurante/Chatbot` en GitHub.
2. En **Google AI Studio** (`https://ai.google.dev/aistudio`), crea una API key en un proyecto **sin cuenta de facturación**.
3. En **Vercel** (`Settings > Environment Variables`), agrega:
   - `GEMINI_API_KEY` = tu clave de AI Studio
   - `GEMINI_MODEL` = `gemini-3.5-flash-lite`
   - `VITE_DEMO_MODE` = `false` (si conectas Firebase) o `true` (modo local sin Firebase)
   - `VITE_ADMIN_EMAIL` = `rafiki.restaurante@gmail.com`
   - Las 6 variables `VITE_FIREBASE_*` de tu proyecto Firebase (Plan Spark).
4. Haz clic en **Redeploy** en Vercel.
