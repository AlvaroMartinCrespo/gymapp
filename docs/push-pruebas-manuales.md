# Notificaciones del cronómetro: pruebas manuales en dispositivo real

Las pruebas automáticas (`npm test`, archivo `scripts/push.test.mjs`) comprueban la lógica con dependencias simuladas y **sin red real**. No verifican que Apple, Google o QStash entreguen el aviso. Eso solo se comprueba aquí, en un móvil.

## Antes de empezar

- Prueba contra **producción** (o un despliegue sin Deployment Protection): QStash tiene que poder llamar a `/api/push/deliver`.
- Variables de Vercel y `APP_URL` configuradas (ver `.env.example`).
- iPhone: iOS/iPadOS 16.4 o superior y la app instalada con *Compartir → Añadir a pantalla de inicio*. Ábrela siempre desde el icono.
- Android: Chrome, con la app abierta en `/cronometro`.
- Si un caso falla, apunta el dispositivo, la versión del sistema y qué pasó en la columna de notas.

Para comprobar solo el envío, sin QStash, usa `scripts/push-deliver-test.mjs` (instrucciones en la cabecera del archivo).

## Lista de verificación

Marca con ✔ (funciona), ✘ (falla) o — (no aplica).

| # | Caso | Cómo probarlo | Resultado esperado | iPhone | Android |
|---|---|---|---|---|---|
| 1 | Activar avisos y aceptar el permiso | En `/cronometro`, tocar "Activar avisos" y aceptar el aviso del sistema | El estado pasa a "Activadas" | ☐ | ☐ |
| 2 | Descanso de 60 s con la pantalla bloqueada | Iniciar un descanso de 60 s y bloquear el móvil | Llega la notificación a los ~60 s (unos segundos de margen) | ☐ | ☐ |
| 3 | App cerrada del todo | Iniciar un descanso de 60 s y quitar la app del selector de apps | Llega la notificación igualmente | ☐ | ☐ |
| 4 | Tocar la notificación | Tocar el aviso en la pantalla de bloqueo o en el centro de notificaciones | Se abre la app en `/cronometro` | ☐ | ☐ |
| 5 | Pausar antes del final | Iniciar 60 s, pausar a los 20 s y esperar 2 minutos | No llega ningún aviso | ☐ | ☐ |
| 6 | Pulsar +30 s | Iniciar 60 s y pulsar +30 s a los 10 s | Llega a los ~90 s desde el inicio, no a los 60 s | ☐ | ☐ |
| 7 | Dos descansos seguidos | Iniciar 60 s, reiniciar y volver a iniciar otro descanso | Llega **un solo** aviso, el del último | ☐ | ☐ |
| 8 | No molestar / Concentración | Activar el modo y repetir el caso 2 | El aviso respeta el modo del sistema (se anota qué ocurre) | ☐ | ☐ |
| 9 | Permiso denegado | Bloquear el permiso en los ajustes del móvil y terminar un descanso con la app abierta | Funciona el respaldo local (vibración y/o notificación local) y la app muestra el estado "Bloqueadas" | ☐ | ☐ |
| 10 | Sin conexión al iniciar | Activar modo avión, iniciar un descanso y volver a tener conexión antes del final | El cronómetro funciona sin errores visibles y el aviso se repara al recuperar la conexión | ☐ | ☐ |

## Comprobaciones extra recomendadas

| Caso | Resultado esperado | iPhone | Android |
|---|---|---|---|
| App abierta en primer plano con push activo | No hay notificaciones dobles | ☐ | ☐ |
| Descanso iniciado desde `/entrenar` al guardar una serie | Llega el aviso con el nombre del ejercicio | ☐ | ☐ |
| Pausar y reanudar | Llega con el tiempo restante, no con el original | ☐ | ☐ |
| Modo cronómetro ascendente | No se programa ningún aviso | ☐ | ☐ |
| Desactivar los avisos desde la app | No llega nada en el siguiente descanso | ☐ | ☐ |

## Notas por dispositivo

| Dispositivo | Sistema | Fecha | Observaciones |
|---|---|---|---|
|  |  |  |  |

## Criterio de "hecho"

`npm test` pasa, `npm run lint` pasa y la lista está completa al menos en el móvil principal.

Limitaciones conocidas que **no** cuentan como fallo: el aviso puede tardar unos segundos; en iPhone suena el tono del sistema; si se pausa a menos de un segundo del final el aviso puede llegar igualmente.
