# Seguridad y privacidad — Rafiki Recordatorios 0.4.0

## Principio obligatorio

El Administrador de Plataforma controla usuarios y accesos, pero no tiene permiso para leer conversaciones, recordatorios ni memoria del agente.

## Datos administrativos

```text
platformUsers/{uid}
accessInvitations/{emailKey}
platformMetrics/{document}
```

## Contenido privado

```text
users/{uid}/messages/{messageId}
users/{uid}/reminders/{reminderId}
users/{uid}/devices/{deviceId}
users/{uid}/agent/session
```

La regla privada exige:

1. sesión autenticada;
2. UID autenticado igual al UID propietario;
3. cuenta activa.

No existe una excepción para `platform_admin`.

## Agente local

Rafiki Agent Core procesa el texto en TypeScript dentro de la PWA. Esta versión no envía conversaciones a proveedores externos de IA.

## Panel administrativo

Las funciones administrativas se limitan a:

- autorizar correos;
- activar cuentas;
- suspender cuentas.

No existe una función backend para listar, buscar, exportar o leer conversaciones privadas.

## Registros técnicos

Los errores del backend no incluyen mensajes ni títulos privados. El despachador push registra cantidades y errores técnicos, no conversaciones completas.

## Límite técnico

Las reglas Firestore protegen el acceso desde SDK web y móvil. Admin SDK y credenciales propietarias de Google Cloud pueden omitirlas. Para impedir también ese acceso se requiere cifrado del lado del cliente o cifrado de extremo a extremo, no incluido todavía.
