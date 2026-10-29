# 🏋️‍♂️ GymApp

PWA minimalista de gimnasio (dark mode, Shadcn/Xiaomi) con visor 3D de músculos, cronómetro flotante, recap, rankings y entrenador IA.

## Estado

- [x] **Fase 1** — Diseño base, PWA y navegación
- [ ] Fase 2 — Supabase, catálogo cerrado y auth (implementada, pendiente de conexión y pruebas reales)
- [ ] Fase 3 — Registro de series, cronómetro, píldora y anatomía 3D implementados; integración completa en Next.js y Supabase pendiente
- [ ] Fase 4 — Perfil, historial, recap con mapa 3D, avisos conservadores y rankings voluntarios implementados; migraciones y pruebas reales pendientes
- [ ] Fase 5 — Chat IA y API Groq implementados; conexión real y feed social pendientes

### Avance de la fase 2

- PostgreSQL en Supabase y despliegue Next.js en Vercel.
- Migración con perfiles, catálogo, entrenamientos, series, alertas y feed; políticas RLS y permisos mínimos.
- Catálogo cerrado de 45 ejercicios en las siete categorías, con músculos primarios, secundarios y cámara inicial.
- Registro, inicio y cierre de sesión en `/acceso` mediante Supabase Auth. Las contraseñas y sesiones no se guardan en tablas propias.
- Cookies HttpOnly, SameSite=Lax y Secure en HTTPS; renovación de tokens. «Mantener sesión» fija un máximo de 90 días sin extenderlo en cada renovación. Sin esa opción, las cookies son de sesión.
- Pendientes: configurar Supabase y Vercel, aplicar el SQL, comprobar RLS en PostgreSQL y probar el flujo de correo y acceso completo.

El catálogo está en [src/db/exercises.json](src/db/exercises.json). Los nombres de músculos son identificadores lógicos provisionales: habrá que contrastarlos con las mallas reales de `human_muscles.glb` cuando se incorpore el modelo en la fase 3.

## Cronómetro

La pantalla `/cronometro` incluye cuenta atrás de descanso y cronómetro ascendente, con pausa, reanudación, reinicio y repetición. Los descansos admiten entre 1 segundo y 1 hora, presets de 1, 1:30, 2, 3 y 5 minutos y ampliación de 30 segundos mientras están activos. El cronómetro ascendente tiene un límite de 99 horas.

El reloj es global: al navegar a otra pantalla aparece una píldora superior con acceso al cronómetro y controles de pausa/reanudación y restablecimiento. Las pestañas del mismo navegador se sincronizan; prevalece el último cambio guardado. No depende de iniciar sesión y el estado es local al navegador, no a una cuenta Supabase.

Se guarda en `localStorage` al cambiar de estado, no en cada tick. El tiempo se calcula con marcas absolutas y se recupera al recargar o volver a la aplicación. El navegador puede suspender JavaScript al bloquear el móvil: no se garantiza una vibración en segundo plano, pero el tiempo mostrado se corrige al volver. Si el almacenamiento está bloqueado, funciona en memoria y muestra un aviso de que la recarga perderá el estado.

`TimerProvider` expone `useTimer().startRest(segundos, nombreDelEjercicio)`. El formulario de `/entrenar` lo invoca únicamente después de recibir la confirmación del guardado en Supabase; un envío fallido no reinicia el descanso.

## Registro de series

`/entrenar` detecta la fecha local del dispositivo, permite filtrar el catálogo cerrado por grupo muscular y ejercicio, muestra las series del día y registra kilos y repeticiones. Se pueden eliminar series con confirmación. El descanso automático se puede desactivar o configurar entre 1 y 5 minutos mediante los valores predefinidos.

Los datos grises del formulario proceden de la última sesión anterior del mismo ejercicio y usuario, asociando cada serie por su número. No se inventan registros si no existe historial y no se reutilizan pesos sin una acción explícita. El formulario no permite guardar sin una sesión válida o si la carga de datos falla.

La API `/api/workouts` verifica o renueva la sesión antes de cada operación y usa el JWT del usuario para que Supabase aplique RLS. El RPC `save_workout_set` crea o bloquea el entrenamiento del día, asigna el número de serie y guarda dentro de la misma transacción. Cada intento usa un UUID; los reintentos del mismo intento en pantalla conservan el UUID y sus datos. Si la respuesta se pierde, se bloquea la edición hasta confirmar el reintento. Esto no sustituye una cola de guardados offline ni conserva intentos pendientes al cerrar o recargar la página.

No se han añadido datos de demostración. El visor usa el GLB anatómico real aportado en `public/models/human_muscles.glb`. Guardar una serie no modifica los récords personales ni ejecuta el detector: el análisis conservador de estancamiento se realiza al finalizar el entrenamiento.

## Rankings

La pantalla de Rankings incluye categorías, ejercicios, clasificación por peso máximo o repeticiones, primeras posiciones, paginación de 50 participantes y la marca/posición propia. Solo cuenta sesiones finalizadas. Cada marca conserva el peso y las repeticiones de una misma serie; cambiar de criterio puede seleccionar otra serie. Los empates en la métrica elegida comparten posición (1, 1, 3). Son registros declarados por los usuarios, no resultados deportivos verificados.

La participación es voluntaria y está desactivada por defecto. Activarla publica el alias y la mejor serie de cada ejercicio para otros usuarios autenticados; no publica identificadores, fechas ni el historial. Retirarse los excluye de las consultas posteriores. La marca propia se puede consultar sin participar. Reabrir o borrar una sesión modifica los resultados derivados, sin mantener puntuaciones obsoletas. No se han añadido publicaciones sociales ni automatizado la bandera `is_pr`.

Aplicar también la octava migración [supabase/migrations/20261029070000_rankings.sql](supabase/migrations/20261029070000_rankings.sql), después de las siete anteriores. Añade `rankings_enabled` y una función autenticada con acceso privilegiado limitado al agregado; no abre las políticas RLS de las series. La API valida filtros, consentimiento explícito y respuesta, conserva cookies renovadas y no cachea los datos. Hay pruebas simuladas y casos SQL opcionales de privacidad, empates, paginación y coherencia de marcas. Quedan pendientes la ejecución real en Supabase, medición de rendimiento con datos representativos y revisión visual.

## Finalización y Avisos

Entrenar incluye una acción explícita para finalizar el día después de confirmar sus series. Se bloquea mientras hay guardados pendientes o datos sin guardar. `finish_workout(p_date)` bloquea la sesión propia, rechaza días vacíos o posteriores al día UTC siguiente (margen para la fecha local), registra `completed_at` y analiza todos sus ejercicios dentro de la misma transacción. Repetir el cierre sin cambios no duplica avisos. La columna de finalización y los metadatos de los avisos no son editables directamente por el cliente.

La regla `STAGNATION_V1` es deliberadamente conservadora: exige tres semanas de calendario consecutivas, con al menos dos días de entrenamiento completados por ejercicio en cada una. La mejor serie semanal se elige por peso y, a igual peso, por repeticiones, siempre de una sola fila. Solo avisa si ese par se mantiene exactamente igual durante las tres semanas. El progreso, las bajadas de rendimiento y las muestras escasas no generan automáticamente un aviso. No estima fatiga fisiológica, no diagnostica y no prescribe una descarga; puede dejar sin detectar otros patrones de estancamiento.

Se guarda como máximo un aviso por usuario, ejercicio y semana. Cambiar las series o mover una sesión reabre su finalización e invalida los avisos automáticos pendientes de los ejercicios afectados; borrar la sesión también invalida los avisos relacionados. Un nuevo cierre vuelve a analizar. Los avisos ya leídos no se reactivan durante la misma semana. Los registros anteriores a esta migración no se consideran completados automáticamente ni se recalculan en bloque.

Perfil consulta hasta cinco avisos pendientes, permite marcarlos como leídos y enlaza al Coach. La API solo permite marcar `is_read` del propietario, con su JWT y RLS. El Coach incorpora los avisos pendientes existentes sin recibir su texto libre. Requiere la séptima migración; quedan pendientes la ejecución de SQL, la concurrencia real y la revisión visual.

## Perfil

La pantalla principal muestra una frase diaria de [src/data/athlete-quotes.json](src/data/athlete-quotes.json), el perfil autenticado, el resumen de los últimos 28 días, actividad de los últimos 7 días y los cinco últimos días con series registradas. Los entrenamientos vacíos no cuentan como días entrenados. Los errores de carga o sesión no se sustituyen por estadísticas ficticias.

Las mejores marcas muestran hasta cinco ejercicios, ordenados por su mayor peso. El peso y las repeticiones corresponden a la misma serie real; en caso de empate de peso, se elige la serie con más repeticiones. Este resumen se calcula al consultar y no modifica `is_pr`, crea publicaciones ni ejecuta el detector de estancamiento.

Se puede guardar o quitar una foto mediante URL HTTPS sin credenciales. La validación comprueba el formato, no que la imagen esté disponible. La imagen se solicita directamente desde el navegador, sin proxy ni optimización en el servidor y sin enviar la cabecera de referencia. Si falla, aparece el avatar predeterminado. La API solo permite modificar el perfil del usuario verificado.

## Desarrollo

Con las dependencias del proyecto ya disponibles:

```bash
npm run dev      # genera los iconos PWA y arranca en http://localhost:3000
npm run build
```

Los iconos PWA se generan con `scripts/generate-icons.mjs` (sin dependencias) antes de `dev` y `build`; no se versionan.

Definir en `.env.local` las variables de [.env.example](.env.example). Solo se usan en el servidor; no requieren el prefijo `NEXT_PUBLIC_` ni una clave administrativa. No se han instalado paquetes para esta migración.

## Historial

El historial `/historial`, enlazado desde Perfil y la navegación de escritorio, muestra un calendario mensual de lunes a domingo con puntos en los días que tienen series. Incluye selector de fecha, navegación mensual, botón Hoy, totales del mes y todas las series del día agrupadas por ejercicio. Los días vacíos no aparecen como entrenados. Las fechas civiles se mantienen en el calendario local, incluidos años bisiestos, con límites entre 2000 y 2100.

La acción `history` de `/api/profile` usa `get_workout_history(p_date)` con el JWT de la sesión y RLS. El mes se consulta con límites inclusivo/exclusivo y el detalle se restringe a la fecha seleccionada. No admite un identificador de usuario suministrado por el navegador. Los resultados no se cachean y las peticiones antiguas se cancelan al cambiar de fecha. Esta vista es de consulta; el registro y la eliminación de series siguen estando en Entrenar. Requiere la quinta migración; la ejecución real de PostgreSQL y la revisión visual siguen pendientes.

## Recap

`/recap` muestra comparativas de semana, mes y año con días entrenados, series, volumen en kg·repeticiones y ejercicios distintos. Permite elegir la fecha de corte y volver a Hoy. Las gráficas muestran volumen diario en semana/mes, volumen mensual en año y series por la categoría principal de cada ejercicio, sin duplicarlas por músculos secundarios. Los días vacíos se muestran a cero y no cuentan como días entrenados. El volumen usa únicamente los kilos registrados; no estima el peso corporal.

La comparación empieza el lunes, el primer día del mes o el primero de enero, según el modo. El periodo anterior abarca el mismo número de días naturales transcurridos, limitado a su final si es más corto. Ambas fechas se muestran explícitamente. En años bisiestos esto compara días transcurridos, no necesariamente la misma fecha de calendario: el 29 de febrero de 2028 se compara hasta el 1 de marzo de 2027. Con una base anterior de cero se muestra la diferencia absoluta, sin inventar un porcentaje.

La acción `recap` de `/api/profile` valida fecha y periodo, verifica la sesión y utiliza `get_workout_recap(p_date, p_period)` con JWT propio y RLS. No admite el usuario ni los totales enviados por el navegador; valida propietario, rangos y totales devueltos. El resumen requiere la sexta migración; el detalle muscular requiere además la novena. Las comprobaciones reales de Supabase y del flujo completo en Next.js siguen pendientes.

### Anatomía 3D real

`MuscleViewer3D` está integrado en `/entrenar` y `/recap`. El visor se sirve desde
`public/anatomy/` dentro de un iframe del mismo origen: Three.js 0.180.0 y el
decodificador Meshoptimizer 0.24.0 están fijados y alojados en `public/vendor/`,
con sus licencias y sumas SHA-256. No requiere instalar paquetes ni consulta un
CDN al abrirse. Se usa Three.js directamente, no Fiber/Drei, para respetar la
restricción de no instalar dependencias. Se ha leído la guía oficial de `use client`
al no existir `node_modules/next/dist/docs/`; no se añaden APIs nuevas de Next.js.

- Modelo real de 634 mallas (~6 MB), con compresión Meshopt y cuantización.
- Equivalencias por nombre anatómico en `public/anatomy/muscles.mjs`: los 22
	identificadores actuales del catálogo conservan sus nombres persistidos.
	Se identifica además el resto de músculos del antebrazo como grupo auxiliar.
- Giro táctil/ratón y controles de teclado, frente/espalda, enfoque suave al
	cambiar de ejercicio y respeto a movimiento reducido.
- Principales en rojo y secundarios en vino, selección por toque y alternativa
	textual. Los músculos profundos pueden quedar ocultos por capas superficiales;
	el listado permite identificarlos aunque no sean visibles desde el ángulo actual.
- Carga diferida del iframe, resolución limitada y renderizado bajo demanda;
	suspensión al ocultarse, liberación de recursos y reintento tras error WebGL.
- Atribución del modelo visible en la interfaz y en `public/models/ATTRIBUTION.md`.
	Verificar el enlace original de descarga y posibles créditos adicionales antes
	de redistribuir públicamente; los créditos disponibles proceden de su metadata.

Para el mapa de frecuencia, aplicar **después de las ocho anteriores**
[la novena migración](supabase/migrations/20261029080000_muscle_recap.sql).
Si falta la octava, aplicar antes [rankings](supabase/migrations/20261029070000_rankings.sql).
Amplía el mismo RPC con `muscles`: cada serie cuenta una vez por músculo principal
y, por separado, por secundario. No hay doble conteo si aparece en ambos arrays.
El color escala con series principales, no con kg ni con una activación fisiológica
estimada; las secundarias no se suman como series principales. Sin la migración,
el recap anterior sigue funcionando y avisa de que falta el detalle muscular.

Pruebas: `npm test` incluye inspección y descompresión del GLB real, equivalencias
de todos los ejercicios, colores, conteos válidos y contratos de permisos/API.
El visor estático puede probarse independientemente de Next.js; esto no sustituye
la prueba del componente React y de Supabase en la aplicación completa.
Comprobado en navegador: carga y descompresión, pecho y espalda, iframe de tamaño
móvil, mapa de calor, error por GLB ausente, pérdida de WebGL y recarga posterior.
Los casos de `supabase/tests/rls.sql` incluyen ahora conteos musculares e
aislamiento entre usuarios; requieren la novena migración aplicada y siguen
pendientes de ejecución contra PostgreSQL real.

## Configurar Supabase

1. Crear un proyecto Supabase. Obtener su URL y la clave **publishable** (también se admite la clave JWT antigua `anon`). Nunca usar `service_role` ni `sb_secret_` para el acceso de usuarios.
2. Ejecutar, en orden, [supabase/migrations/20261029000000_initial.sql](supabase/migrations/20261029000000_initial.sql), [supabase/migrations/20261029010000_workout_operations.sql](supabase/migrations/20261029010000_workout_operations.sql), [supabase/migrations/20261029020000_profile_overview.sql](supabase/migrations/20261029020000_profile_overview.sql), [supabase/migrations/20261029030000_coach.sql](supabase/migrations/20261029030000_coach.sql), [supabase/migrations/20261029040000_workout_history.sql](supabase/migrations/20261029040000_workout_history.sql), [supabase/migrations/20261029050000_workout_recap.sql](supabase/migrations/20261029050000_workout_recap.sql) y [supabase/migrations/20261029060000_training_alerts.sql](supabase/migrations/20261029060000_training_alerts.sql). Aplicar únicamente las que falten: no repetir migraciones ya ejecutadas. La segunda habilita las operaciones de series; la tercera, el resumen de perfil; la cuarta, el contexto privado y la cuota del entrenador IA; la quinta, el historial mensual; la sexta, el recap; la séptima, la finalización y los avisos conservadores.
3. Ejecutar [supabase/seed.sql](supabase/seed.sql) en el SQL Editor. Puede repetirse: actualiza el catálogo por ID sin borrar entrenamientos.
4. En Authentication, habilitar correo/contraseña y confirmación de correo; configurar una longitud mínima de contraseña de 10 caracteres. El alta crea automáticamente el perfil mediante un trigger.
5. En Authentication > URL Configuration, establecer `Site URL` en `https://tu-dominio/acceso`. Para desarrollo, usar un proyecto de pruebas con `http://localhost:3000/acceso`. Añadir únicamente las URLs de redirección exactas necesarias para cada entorno.

Tras confirmar el correo, se vuelve a `/acceso` para iniciar sesión. No hay inicio automático desde el enlace. Las restricciones adicionales de duración de sesiones que se configuren en Supabase prevalecen sobre los 90 días de las cookies.

Las tablas privadas solo se pueden consultar o modificar como su propietario. El catálogo es de solo lectura para clientes. Los campos calculados (`is_pr`), las nuevas alertas y las publicaciones se reservan al servidor; sus procesos se implementarán en fases posteriores. El feed público de usuarios autenticados no incluye correos ni contraseñas.

La fuente de las migraciones es `supabase/migrations/`, incluyendo las restricciones y RLS. El esquema Drizzle es un mapa PostgreSQL para el código; las migraciones SQLite antiguas de `drizzle/` se conservan solo como historial y como fixture del test de portabilidad del seed. No deben aplicarse a Supabase. Este cambio no migra datos de una base D1 existente.

## Catálogo y CLI

Regenerar el archivo de seed tras cambiar el catálogo:

```bash
npm run db:seed
npm run db:seed:sql
```

Estos comandos generan SQL, no modifican ninguna base de datos. Con Supabase CLI y Docker ya disponibles, `supabase start` usa [supabase/config.toml](supabase/config.toml). Con un proyecto remoto previamente enlazado, `npm run db:push` aplica las migraciones; cargar después el seed en su SQL Editor. Ningún comando usa `npx` ni descarga herramientas automáticamente.

## Entrenador IA con Groq

La página `/coach`, accesible también desde Perfil en móvil, utiliza `/api/ai-coach` con sesión Supabase y el modelo fijo **`qwen/qwen3.8-27b`**. Añadir `GROQ_API_KEY` únicamente en el servidor, tanto en el entorno local como en Vercel. No se usa un SDK ni se han instalado paquetes. La disponibilidad del identificador en Groq no está verificada: si no existe o no está autorizado, se muestra un error y no se cambia a otro modelo.

Antes de invocar Groq se reserva una consulta en PostgreSQL y se obtiene el resumen del usuario mediante su JWT y RLS: 28 días hasta la fecha local, días y series reales, volumen en kg·repeticiones, agregados semanales por ejercicio y hasta cinco alertas pendientes de ese periodo. Peso y repeticiones de cada mejor serie proceden de una sola fila. Se envían como máximo 80 agregados semanales y 60 ejercicios del catálogo; el modelo recibe el número total para reconocer si el contexto está recortado. Consultar el Coach no genera avisos nuevos: los de estancamiento proceden del cierre explícito del entrenamiento. La presencia o ausencia de avisos no demuestra fatiga ni recuperación.

La cuota atómica es de **5 intentos por minuto natural y 50 por día UTC y usuario**, independiente de la fecha enviada por el navegador. La tabla de cuota no permite lectura ni modificación al cliente. Cada intento admitido cuenta aunque falle después la carga del contexto o el proveedor; reintentar consume otro intento y cancelar puede no recuperarlo. Sin clave Groq no se reserva cuota. Un rechazo de cuota devuelve `429` y `Retry-After`. No sustituye a los límites de gasto de la cuenta Groq; configurarlos también en el proveedor.

El contexto enviado al proveedor excluye email, identificador de cuenta, foto y texto libre de alertas. Los mensajes escritos por el usuario sí se envían: no incluir datos personales. El chat solo permanece en memoria de la página, sin persistencia de conversaciones en la aplicación; el proveedor aplica sus propias políticas de tratamiento de datos. Se transmiten hasta 11 mensajes alternos, con límites de tamaño y sin instrucciones de sistema aportadas por el navegador. Las respuestas se muestran como texto, sin HTML ni ejecución de acciones; se excluye el razonamiento interno y se advierte si la salida es parcial. El entrenador no modifica entrenamientos ni sustituye una valoración médica.

## Desplegar en Vercel

1. Importar el repositorio en Vercel como proyecto Next.js. La configuración está en [vercel.json](vercel.json); el comando de compilación es `npm run build`.
2. Añadir `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `GROQ_API_KEY` en las variables de entorno de Vercel, con los valores del proyecto correspondiente a Production o Preview.
3. Aplicar previamente la migración y el seed en Supabase y configurar las URLs de Auth para el dominio de Vercel o el dominio propio.
4. Desplegar y comprobar alta, correo de confirmación, acceso, recarga, cierre de sesión y aislamiento entre dos usuarios. Vercel no aplica las migraciones automáticamente durante el build.

## Pruebas

Las pruebas de finalización y avisos cubren autenticación, fechas, respuestas incoherentes, lectura privada, marcado como leído y contratos de permisos. La prueba SQL opcional añade tres semanas de sesiones completadas, progreso en peso/repeticiones, muestras escasas, sesiones sin finalizar, repetición del cierre, lectura, invalidación al editar/mover/borrar y aislamiento entre usuarios. Sin PostgreSQL solo se comprueban los contratos y los proveedores simulados, no la ejecución del detector.

Las pruebas del recap cubren rangos comparables, semanas de lunes a domingo, cambios de año y años bisiestos, porcentajes con base cero, sesión, cookies, propiedad de los datos y errores del proveedor. La prueba SQL opcional añade fechas fijas para validar cortes temporales, meses y años, ceros de las gráficas y aislamiento entre usuarios.

Las pruebas del historial cubren el calendario de 42 casillas, inicio de semana en lunes, años bisiestos, cambio de año, límites de fecha, consulta con JWT propio, meses vacíos, rechazo de respuestas de otro usuario o fecha y renovación de cookies. La prueba SQL opcional también comprueba totales mensuales, orden y detalle de series, días vacíos y aislamiento entre usuarios.

Las pruebas del Coach comprueban el modelo exacto sin fallback, autorización, cuota, renovación de cookies, minimización de contexto, límites de mensajes y errores sanitizados con proveedores simulados. No invocan Groq ni verifican la disponibilidad real del modelo.

Sin dependencias npm instaladas, las pruebas requieren Node.js 22.18 o posterior (con soporte nativo de TypeScript) y `sqlite3`:

```bash
npm test
```

Se comprueban los flujos de Auth, entrenamiento y perfil con respuestas simuladas, los contratos estáticos de RLS, la idempotencia del SQL del catálogo en SQLite y el cronómetro con reloj y almacenamiento simulados. Las pruebas de perfil incluyen propiedad de los datos, URL HTTPS, renovación de cookies y ausencia de descargas de imágenes desde el servidor. Las de entrenamiento cubren validación, autorización, renovación, privacidad y conservación del identificador de reintento. Las del cronómetro cubren bloqueos, pausas, recargas, sincronización entre pestañas, limpieza de recursos y fallo de almacenamiento. Eso no equivale a validar PostgreSQL, concurrencia real, la entrega de correos ni la interfaz en navegador.

Para ejecutar además la prueba RLS real, definir `SUPABASE_TEST_DATABASE_URL` fuera del repositorio y disponer de `psql`. Debe apuntar a una base Supabase **de pruebas**, con las ocho migraciones aplicadas y un usuario propietario capaz de insertar fixtures en `auth.users` y cambiar de rol. La prueba carga el catálogo, crea dos usuarios, comprueba permisos, entrenamiento, perfil, historial, recap, contexto del Coach y cuotas, finalización, avisos y rankings voluntarios, y termina con `ROLLBACK`. No usar producción. Sin esa variable, la prueba se omite explícitamente.

## Instalar como app

- **iPhone/iPad:** Safari → Compartir → *Añadir a pantalla de inicio*
- **Android/Desktop:** Chrome → *Instalar aplicación*

## Stack

Next.js 16 (App Router) · Vercel · Supabase PostgreSQL/Auth · Drizzle ORM · TypeScript · Tailwind CSS 4 · estilo shadcn/ui · lucide-react · Geist (autoalojada)
