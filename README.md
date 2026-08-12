# Rafiki Recordatorios — 0.4.0

**Fase 2B — Rafiki Agent Core**

PWA multiusuario con interfaz tipo chat y un agente especializado en recordatorios. El agente funciona con TypeScript, reglas, skills y memoria conversacional propia. No utiliza Gemini ni otra IA externa.

## Funciones principales

- Chat privado con identidad propia inspirada en aplicaciones de mensajería.
- Agente local especializado en recordatorios.
- Respuestas naturales con cuatro personalidades configurables.
- Memoria conversacional para completar instrucciones de varios mensajes.
- Detección de ambigüedades; pregunta antes de adivinar.
- Creación de recordatorios únicos y recurrentes.
- Consulta, reprogramación, posposición, cancelación y finalización por chat.
- Panel administrativo de accesos sin permiso para leer conversaciones.
- PWA instalable en celular y computador.
- Firebase Authentication, Firestore, Functions y FCM preparados.
- Modo demostración local sin Firebase ni costos.

## Arquitectura del agente

```text
Rafiki Agent Core
├── Intent Router
├── Date and Time Parser
├── Dialogue State
├── Reminder Reference Resolver
├── Skill Executor
├── Response Composer
├── User Preferences
└── Confidence Engine
```

### Skills incluidas

```text
createReminder
listReminders
updateReminder
postponeReminder
completeReminder
cancelReminder
showHelp
greetUser
```

## Ejemplos que entiende

```text
Recuérdame pagar la luz mañana a las 8.
En media hora recuérdame apagar el horno.
Todos los lunes a las 9 recuérdame revisar los pagos.
¿Qué tengo pendiente para mañana?
Pospón el recordatorio del internet 20 minutos.
Marca como completada la llamada a Juan.
Cancela el último recordatorio.
Cambia la cita del médico para el viernes a las 3 de la tarde.
```

También maneja conversaciones como:

```text
Usuario: Recuérdame llamar al médico mañana.
Rafiki: ¿A qué hora quieres que te lo recuerde?
Usuario: A las 3.
Rafiki: ¿Te refieres a las 3:00 de la mañana o de la tarde?
Usuario: De la tarde.
Rafiki: Listo, te recordaré llamar al médico mañana a las 3:00 p. m.
```

## 1. Probar sin Firebase y sin costos

```bash
cp .env.example .env.local
npm install
npm run dev
```

Conserva esta variable:

```env
VITE_DEMO_MODE=true
```

Los mensajes, recordatorios, preferencias y memoria conversacional se guardan únicamente en el navegador mediante `localStorage`.

## 2. Personalidad configurable

Cada usuario puede elegir:

- Cercano.
- Profesional.
- Directo.
- Motivador.
- Respuestas cortas o equilibradas.
- Uso o no de emojis.
- Hora predeterminada para “por la mañana”.
- Hora predeterminada para “después del almuerzo”.
- Hora predeterminada para “por la noche”.

## 3. Configurar Firebase

1. Crea o selecciona el proyecto Firebase.
2. Habilita Authentication con Google y correo/contraseña.
3. Crea Firestore en modo producción.
4. Registra una aplicación web.
5. Copia `.env.example` como `.env.local`.
6. Completa las variables públicas de Firebase.
7. Cambia:

```env
VITE_DEMO_MODE=false
```

8. Instala Firebase CLI y selecciona el proyecto:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

9. Publica reglas e índices:

```bash
npm run deploy:rules
```

## 4. Configurar Cloud Functions

```bash
cd functions
cp .env.example .env
npm install
npm run build
cd ..
```

No se necesita API key de IA. El agente se ejecuta dentro del frontend y guarda únicamente su estado privado bajo el UID del usuario.

Despliega las funciones administrativas:

```bash
npm run deploy:functions-core
```

## 5. Crear el primer Administrador de Plataforma

Crea primero la cuenta en Firebase Authentication. Después descarga temporalmente una cuenta de servicio y ejecuta:

```bash
cd functions
npm run set-admin -- administrador@ejemplo.com ./service-account.json
```

No subas la cuenta de servicio a GitHub. Cierra sesión y vuelve a ingresar para renovar el token.

El administrador puede:

- Autorizar correos.
- Activar o suspender cuentas.
- Ver metadatos operativos.
- Gestionar accesos.

El administrador no puede:

- Abrir conversaciones.
- Leer mensajes.
- Consultar títulos de recordatorios.
- Buscar contenido privado.
- Acceder al estado conversacional del agente.

## 6. Notificaciones push

1. Genera una clave Web Push VAPID en Firebase Cloud Messaging.
2. Configura:

```env
VITE_FIREBASE_VAPID_KEY=
```

3. En `functions/.env`, mantén inicialmente:

```env
ENABLE_SCHEDULED_PUSH=false
```

4. Cuando hayas validado FCM, cambia a `true` y despliega:

```bash
npm run deploy:functions-push
```

El despachador utiliza una sola función programada global y `maxInstances: 1`.

## 7. Desplegar la PWA

```bash
npm install
npm test
npm run build
firebase deploy --only hosting
```

El código fuente puede mantenerse en un repositorio privado de GitHub y conectarse a un despliegue automático.

## 8. Estructura privada

```text
platformUsers/{uid}                       # metadatos administrativos
users/{uid}/messages/{messageId}         # mensajes privados
users/{uid}/reminders/{reminderId}       # recordatorios privados
users/{uid}/devices/{deviceId}           # dispositivos privados
users/{uid}/agent/session                # memoria privada del agente
```

Las reglas exigen que el UID autenticado coincida con el propietario. No existe excepción para `platform_admin` en `users/{uid}`.

## 9. Costos

- El agente no consume tokens ni llama modelos externos.
- El modo demo cuesta USD 0.
- FCM no tiene costo directo por mensaje.
- El despachador push permanece desactivado hasta configurarlo.
- La aplicación limita la carga inicial del chat a 100 mensajes.
- Las funciones tienen límites bajos de instancias.

## 10. Limitaciones actuales

- El agente está especializado únicamente en recordatorios.
- Todavía no comprende todas las expresiones posibles del español.
- La recurrencia se limita a diaria, días hábiles y semanal.
- No hay reconocimiento de voz.
- No existe cifrado de extremo a extremo.
- Una persona con acceso propietario al proyecto Google Cloud podría leer datos sin cifrar mediante herramientas técnicas.
- No existe integración con WhatsApp en esta fase.

## 11. Mejoras futuras sugeridas

- Recurrencias mensuales y anuales.
- Seguimientos condicionales: “si no lo completo, avísame otra vez”.
- Mensajes de voz.
- Recordatorios compartidos.
- Aprendizaje controlado de frases no comprendidas con autorización del usuario.
- Cifrado del lado del cliente.
- IA externa opcional únicamente como respaldo.
