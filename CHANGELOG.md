# Historial de versiones

## Corrección de seguridad — 2026-10-15

- Eliminadas las credenciales embebidas y el acceso directo a Gemini desde el navegador.
- Gemini utiliza exclusivamente /api/gemini y una variable privada del servidor.
- Excluidos los archivos de entorno privados del paquete.

## 0.5.0 — 2026-10-14 — Fase 2C (Híbrido: Rafiki Agent Core + Gemini Free Tier + Vercel)

- Arquitectura híbrida en `src/agent/geminiFallback.ts`: ejecuta primero `Rafiki Agent Core` localmente (0 ms, $0 USD) y usa Gemini API (`gemini-3.5-flash-lite` / `gemini-2.5-flash`) como respaldo inteligente cuando la frase es compleja, conversacional o tiene baja confianza.
- Nuevo endpoint Serverless `/api/gemini.ts` para **Vercel (Plan Hobby gratuito)** que protege `GEMINI_API_KEY` en el servidor sin requerir el plan Blaze de pago en Firebase.
- Soporte completo para el **Plan Spark gratuito de Firebase** en `src/services/data.ts` y `firestore.rules` (permite registro e inicio de sesión con Auth + Firestore sin obligar a desplegar Cloud Functions).
- Corrección de errores de compilación en Vercel (`tsconfig.node.json`, `vite.config.ts`, `package.json` y nuevo `vercel.json`) que causaban fallos al hacer *deploy* desde GitHub.
- Nuevo interruptor en `Configuración` para activar o desactivar el respaldo de Gemini por usuario.

## 0.4.0 — 2026-08-06 — Fase 2B

- Reemplazo completo de Gemini por Rafiki Agent Core.
- Motor privado en TypeScript sin consumo por tokens.
- Enrutador de intenciones y registro de skills.
- Memoria conversacional privada por usuario.
- Preguntas aclaratorias cuando faltan fecha, hora o actividad.
- Detección de horas ambiguas a. m./p. m.
- Soporte conversacional para crear, listar, completar, cancelar, posponer y reprogramar.
- Resolución de referencias como “el último”, “ese” o una parte del título.
- Personalidades: cercana, profesional, directa y motivadora.
- Respuestas cortas o equilibradas y emojis configurables.
- Horarios configurables para mañana, tarde y noche.
- Conversión de fechas respetando la zona horaria del usuario.

## 0.3.0 — 2026-08-01 — Fase 2A

- Primera PWA funcional de recordatorios con interfaz tipo chat.
- Modo demostración local.
- Arquitectura multiusuario Firebase.
- Panel administrativo sin acceso a contenido privado.
- Notificaciones locales y FCM preparado.
