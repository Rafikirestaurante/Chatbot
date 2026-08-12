# Arquitectura del agente — Rafiki Agent Core

## Objetivo

Interpretar y ejecutar instrucciones de recordatorios sin depender de un modelo generativo externo.

## Flujo

```text
Mensaje
  ↓
Intent Router
  ↓
Extracción de fecha, hora, recurrencia y referencia
  ↓
Validación de confianza y ambigüedad
  ↓
Selección de skill
  ↓
Ejecución controlada
  ↓
Response Composer
  ↓
Persistencia de memoria conversacional privada
```

## Intenciones soportadas

- `create_reminder`
- `list_reminders`
- `complete_reminder`
- `cancel_reminder`
- `postpone_reminder`
- `update_reminder`
- `greeting`
- `help`
- `cancel_dialogue`
- `unknown`

## Memoria conversacional

La memoria almacena solamente la acción pendiente y los datos faltantes. Ejemplo:

```json
{
  "pending": {
    "kind": "create_reminder",
    "originalInput": "Recuérdame llamar al médico mañana",
    "missing": ["time"]
  }
}
```

Se guarda en `users/{uid}/agent/session`, protegida por las mismas reglas privadas del usuario.

## Confianza

Cada interpretación produce un nivel de confianza. Las instrucciones claras se ejecutan. Cuando falta información o existe ambigüedad, el agente pregunta antes de crear o modificar un recordatorio.

## Respuestas naturales

El compositor usa variantes controladas, no texto generado libremente. Esto permite:

- mantener una personalidad coherente;
- evitar respuestas repetitivas;
- impedir alucinaciones;
- conservar costos de IA en cero;
- revisar todas las respuestas posibles.

## Privacidad

El agente se ejecuta en el cliente. No envía el mensaje a Gemini, OpenAI ni otro proveedor. Las acciones se sincronizan con Firestore únicamente después de validarse.
