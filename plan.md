🏋️‍♂️ Proyecto: GymApp (Minimalist SaaS PWA + 3D Engine) - Hoja de Ruta Definitiva
Este documento contiene la especificación técnica, arquitectura de base de datos, diseño de interfaz y los pasos para construir la aplicación web progresiva (PWA) de gimnasio en GitHub, Vercel y Supabase. El uso gratuito queda sujeto a los límites vigentes de cada servicio.

1. Visión General, Diseño y Stack Tecnológico
🎨 Identidad Visual (UI/UX)
Estilo Combinado: Minimalist SaaS UI + Estilo Shadcn UI + Estética Xiaomi (tarjetas limpias, bordes muy redondeados rounded-2xl, micro-interacciones suaves, tipografía sin serifa clara como Inter o Geist).
Paleta de Colores (Dark Mode Estricto):
Fondo Principal: Negro puro (#09090b) y Gris oscuro para tarjetas (#18181b) con bordes sutiles (#27272a).
Cuerpo 3D Base: Material mate metálico oscuro (#27272a) para los músculos inactivos.
Color de Acento Primario (Rojo Neón/Intenso): #ef4444 con efecto de emisión (glow) en el modelo 3D para los músculos principales del ejercicio, botones clave, píldora de cronómetro y récords (PRs).
Color Secundario (Rojo Vino/Oscuro): #991b1b para los músculos secundarios/sinergistas en el modelo 3D y comparativas.
Texto: Blanco puro (#ffffff) para títulos y números grandes; gris claro (#a1a1aa) para subtítulos y datos fantasma (Ghost Data).
Formato PWA (Progressive Web App): Instalable en iPhone/iPad ("Añadir a pantalla de inicio"), Android y Desktop a pantalla completa (display: standalone), sin barras de navegador.
🛠️ Stack Tecnológico (100% Gratuito)
Repositorio: GitHub (alojando el modelo .glb comprimido en /public/models/human_muscles.glb para servirlo como archivo estático desde Vercel).
Fullstack Framework: Next.js (App Router) con React desplegado en Vercel.
UI & Gráficos: Tailwind CSS + Shadcn UI + Lucide Icons + Recharts.
Motor 3D Interactivo (Opción B - 3D Real Giratorio):
three + @react-three/fiber (Renderizador WebGL en React).
@react-three/drei (Para OrbitControls —rotar con el dedo/ratón—, useGLTF —cargar el cuerpo— e iluminación).
Base de Datos: Supabase PostgreSQL con políticas Row Level Security.
Identidad: Supabase Auth; registro por correo y contraseña con confirmación de correo.
ORM: Drizzle ORM para el modelo PostgreSQL; migraciones SQL de Supabase como fuente de verdad.
Inteligencia Artificial: Groq API con el modelo qwen/qwen3.8-27b, sin sustitución automática por otro modelo.

2. Motor 3D Giratorio de Músculos (<MuscleViewer3D />)
El archivo /public/models/human_muscles.glb es un modelo 3D anatómico dividido por mallas independientes (meshes), donde cada grupo muscular tiene un nombre único en el modelo:
Pecho: mesh_pectoralis
Espalda: mesh_latissimus, mesh_trapezius, mesh_rhomboids, mesh_lower_back
Piernas: mesh_quadriceps, mesh_hamstrings, mesh_gluteus, mesh_calves, mesh_adductors
Hombros: mesh_deltoid_anterior, mesh_deltoid_lateral, mesh_deltoid_posterior
Brazos: mesh_biceps, mesh_triceps, mesh_forearms
Core: mesh_abs, mesh_obliques
✨ Comportamiento en la App:
Rotación 360º Táctil: El usuario puede girar el modelo 3D con el dedo o el ratón en cualquier momento (<OrbitControls enableZoom={false} enablePan={false} />).
Enfoque Automático: Al seleccionar un ejercicio del catálogo (ej. Prensa de Piernas), la cámara rota suavemente hacia la vista frontal/inferior e ilumina mesh_quadriceps en Rojo Intenso (#ef4444) y mesh_gluteus + mesh_hamstrings en Rojo Oscuro (#991b1b).
Mapa de Calor en el Recap: En la pantalla de resumen semanal/mensual, el mismo modelo 3D colorea todo el cuerpo según el volumen de series que hayas hecho en cada músculo durante ese periodo.

3. Arquitectura de la Base de Datos (Supabase PostgreSQL)
auth.users y sesiones de Supabase Auth:
Supabase gestiona credenciales, correos y tokens. No hay tablas públicas de contraseñas ni sesiones propias.
profiles:
id (UUID que referencia auth.users), username único sin distinguir mayúsculas, avatar_url HTTPS, created_at.
Sesión web: tokens en cookies HttpOnly; Secure en HTTPS; SameSite=Lax. Mantener sesión fija una fecha límite de 90 días. Sin esa opción, cookies de sesión.
RLS: perfiles, entrenamientos, series y alertas aislados por propietario; catálogo de solo lectura; publicaciones y campos calculados reservados al servidor.
exercises_catalog (Catálogo 100% Cerrado y Predefinido):
id (ej. 'leg_press'),
name ('Prensa de Piernas'),
category ('Pecho' | 'Espalda' | 'Piernas' | 'Hombros' | 'Bíceps' | 'Tríceps' | 'Core'),
primary_meshes (JSON: ["mesh_quadriceps"]),
secondary_meshes (JSON: ["mesh_gluteus", "mesh_hamstrings"]),
default_camera ('front' | 'back').
workout_logs:
id, user_id, date (YYYY-MM-DD).
workout_sets:
id, workout_log_id, exercise_id (clave foránea obligatoria al catálogo), set_number, weight (kg), reps, is_pr (booleano).
ai_alerts (Detector Automático de Descarga/Fatiga):
id, user_id, exercise_id, alert_type ('STAGNATION' | 'FATIGUE'), message, is_read, created_at.
social_feed (Opcional):
id, user_id, type ('WORKOUT_SUMMARY' | 'NEW_PR'), reference_id, likes_count, created_at.

4. Diseño de Pantallas y Funcionalidades
🔐 A. Autenticación (Login / Registro)
Formulario oscuro estilo Shadcn.
Checkbox "Mantener sesión iniciada": Crea una cookie segura de larga duración para entrar directamente al abrir la app desde el icono de inicio del móvil.
👤 B. Perfil (Pantalla de Inicio)
Foto de Perfil mediante URL: Campo para pegar el link HTTPS de la imagen (sin subir archivos pesados) y guardarlo en Supabase. Incluye avatares minimalistas en rojo/negro por defecto si no se pone URL.
Frase de Motivación al Entrar: Tarjeta destacada con frases de superación y de leyendas del deporte (Kobe Bryant, Arnold, Jordan, Muhammad Ali, David Goggins).
🚨 Alerta Inteligente de Fatiga/Descarga (IA):
Con tres semanas consecutivas de mejor serie estable y al menos dos sesiones completadas por ejercicio y semana, aparece un aviso de posible estancamiento en el perfil y un enlace al Coach. No se diagnostica fatiga ni se prescribe descarga a partir de estos datos; las bajadas de rendimiento requieren contexto adicional.
Resumen: Últimos días entrenados y tarjetas con tus ejercicios más fuertes (PRs).
📝 C. Apuntar Ejercicios (Catálogo Cerrado + Visor 3D)
Prohibido escribir nombres de ejercicios: El usuario siempre selecciona de la lista predefinida para mantener el orden y los rankings limpios.
Flujo ultra sencillo:
Cabecera con el día de la semana actual seleccionado automáticamente.
Píldoras de Categoría: Pecho, Espalda, Piernas, Hombros, Bíceps, Tríceps, Core.
Selector de Ejercicio: Muestra solo los ejercicios esenciales de esa categoría (sin agobiar).
Modelo 3D en vivo: Al tocar el ejercicio, el cuerpo 3D gira e ilumina en rojo los músculos que trabaja.
Apuntar Serie con "Ghost Data": Aparece en gris clarito el peso y repeticiones de la última vez. Botones rápidos (+2.5kg, +1 rep) y botón rojo Guardar Serie.
⏱️ D. Cronómetro + "Mini-Pill" Flotante (Estilo Xiaomi)
Página de Cronómetro: Reloj minimalista a pantalla completa con botones rápidos de descanso (1:00, 1:30, 2:00, 3:00) y cronómetro libre.
💊 La Píldora Flotante (Mini-Pill):
Al pulsar Guardar Serie en cualquier ejercicio, se activa sola en la parte superior de la pantalla una píldora flotante negra con borde rojo (⏱️ 01:30) estilo Dynamic Island.
Te sigue por toda la aplicación mientras descansas y avisa al llegar a 00:00.
🤖 E. Entrenador IA con Groq (Conectado a tu Base de Datos)
Cuando le escribes a la IA, el backend adjunta de forma invisible un resumen de Supabase (últimas 4 semanas de entrenamientos, evolución de pesos y alertas de fatiga).
Consultas clave:
Estancamiento: "Llevo 3 semanas con los mismos pesos, ¿qué me aconsejas?" -> Te propone una semana de descarga con porcentajes exactos según tus kilos actuales.
Molestias: "Me duele el codo al hacer este ejercicio, ¿qué puedo hacer?" -> Te da pautas biomecánicas y te dice por qué otro ejercicio del catálogo predefinido de la app sustituirlo hoy.
📊 F. Recap (Semana / Mes / Año) + Historial por Días
Comparativas: Tarjetas y gráficas en rojo/blanco comparando Semana actual vs anterior, Mes actual vs anterior y Año (más/menos peso total movido, más/menos ejercicios y series).
Cuerpo 3D de Frecuencia: El modelo 3D iluminando qué músculos has trabajado más en la semana o el mes.
Calendario de Historial: Selecciona cualquier día del calendario para ver exactamente qué ejercicios y pesos hiciste esa fecha.
🏆 G. Rankings Globales
Paso 1: Elegir Categoría (Piernas, Pecho, Bíceps, etc.).
Paso 2: Elegir Ejercicio del catálogo predefinido (Prensa de Piernas).
Paso 3: Alternar Switch entre [ Peso Máximo (Kg) ] o [ Más Repeticiones ].
Muestra el Top de usuarios registrados y fija tu posición actual en la barra inferior.
🌐 H. Feed Social de Tarjetas Automáticas (Opcional)
Sin texto libre para evitar que sea como Twitter.
Solo permite publicar tarjetas generadas por el sistema al terminar el día (Resumen de Entrenamiento) o al batir un récord (Nuevo PR), donde el resto de usuarios puede reaccionar con un icono de fuego (🔥).

5. Plan de Ejecución Paso a Paso (Orden de Desarrollo)

Estado comprobado (2026-10-29):
- Fase 1: estructura, navegación y configuración PWA presentes; despliegue no verificado.
- Fase 2: modelo PostgreSQL y migración Supabase con RLS preparados. Catálogo de 48 ejercicios y seed idempotente implementados. Aplicación del SQL en Supabase pendiente.
- Paso 2.4: registro, inicio/cierre de sesión, renovación y cookies HttpOnly implementados con Supabase Auth. Pruebas con proveedor simulado superadas; faltan configuración y prueba real de correo y acceso. La fase 2 todavía no se considera cerrada.
- Fase 3: cronómetro, cuenta atrás, píldora global, registro de series y visor anatómico real implementados. El GLB aportado tiene 634 mallas, compresión Meshopt y atribución CC BY-SA 4.0. Los 22 identificadores musculares reales del catálogo se conservan y se corresponden con mallas del modelo; el grupo auxiliar de antebrazos también es identificable. Giro táctil/ratón/teclado, enfoque suave, principales/secundarios y errores WebGL preparados. Three.js y Meshopt se sirven como archivos estáticos locales con versiones fijadas, sin instalación ni Fiber/Drei. Carga, colores y tamaño móvil comprobados en navegador sobre el visor estático. Pendientes: aplicar/comprobar SQL y verificar el flujo React completo en Next.js/Supabase y en dispositivos físicos.
- Fase 4: perfil, historial mensual, recap estadístico con mapa muscular 3D, finalización explícita, avisos conservadores y rankings voluntarios implementados. Migraciones preparadas hasta la novena. La novena añade series principales/secundarias reales por músculo con RLS, sin estimaciones por categoría ni dobles conteos. Sin aplicarla, el recap anterior funciona y muestra el aviso de detalle no disponible. Pendientes: integración real, concurrencia, revisión visual de la app completa y rendimiento. La automatización de `is_pr` sigue pendiente. No se infiere fatiga fisiológica ni se prescribe descarga.
- Fase 5: chat y endpoint autenticado implementados para Groq con qwen/qwen3.8-27b, contexto real de 28 días, alertas pendientes y cuota atómica por usuario. Cuarta migración preparada. Pendientes: configurar la clave, aplicar SQL, verificar disponibilidad del modelo y probar la integración real y el navegador. Feed opcional pendiente.
- No se han instalado paquetes. El runtime 3D autocontenido se ha descargado como archivos estáticos con licencias y versiones fijadas. Sin node_modules, PostgreSQL ni credenciales remotas siguen pendientes lint/build, revisión visual de la app completa, prueba RLS real y despliegue. El visor estático sí se ha comprobado en navegador. La guía de conexión está en README.md.

Fase 1: Repositorio, Diseño Base y Configuración PWA
Paso 1.1: Crear el repositorio en GitHub e inicializar el proyecto con Next.js (App Router) y TypeScript.
Paso 1.2: Instalar Tailwind CSS y Shadcn UI. Configurar las variables CSS en globals.css con la paleta estricta en Negro (#09090b), Gris tarjeta (#18181b), Rojo (#ef4444) y Blanco (#ffffff).
Paso 1.3: Configurar el archivo manifest.json, iconos y etiquetas meta de iOS (apple-mobile-web-app-capable) para que funcione como aplicación nativa (PWA) al añadirla a la pantalla de inicio en iPhone, Android y Desktop.
**Paso 1.4:**Crear la barra de navegación inferior fija (Bottom Bar) para móvil y barra lateral (Sidebar) para escritorio.
Paso 1.5: Conectar GitHub con Vercel, configurar las variables de entorno y desplegar Next.js en cada git push.
Fase 2: Base de Datos (Supabase PostgreSQL), Catálogo Cerrado y Auth
Paso 2.1: Crear el proyecto Supabase y configurar SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en local y Vercel. No usar claves administrativas para autenticar usuarios.
Paso 2.2: Aplicar las migraciones Supabase con profiles, exercises_catalog, workout_logs, workout_sets, ai_alerts y social_feed, sus restricciones y políticas RLS. Identidad y sesiones delegadas a Supabase Auth.
Paso 2.3: Crear y ejecutar el script Seed que rellena la tabla exercises_catalog con los ~48 ejercicios principales divididos por categoría y asociados a sus mallas 3D (primary_meshes y secondary_meshes).
Paso 2.4: Registro e Inicio de Sesión con Supabase Auth, confirmación de correo, renovación de tokens, cierre de sesión y checkbox de "Mantener sesión iniciada" mediante cookies HttpOnly de hasta 90 días.
Fase 3: Visor 3D Giratorio, Apuntar Ejercicios y Píldora de Cronómetro
Paso 3.1: Guardar el modelo 3D anatómico comprimido (human_muscles.glb) en /public/models/ dentro del repositorio de GitHub.
Paso 3.2: Instalar three, @react-three/fiber y @react-three/drei. Crear el componente <MuscleViewer3D /> que permite girar el cuerpo 360º con el dedo y pinta en rojo intenso los músculos primarios y en rojo oscuro los secundarios.
Estado: implementado sin instalar dependencias, usando Three.js 0.180.0 y Meshoptimizer 0.24.0 estáticos y locales en un iframe del mismo origen. Se sustituye la instalación de Fiber/Drei por Three.js directo para respetar la restricción del proyecto. El archivo real no usa los nombres `mesh_*` propuestos arriba: `public/anatomy/muscles.mjs` mantiene equivalencias con los identificadores persistidos del catálogo (`pectoralis_major`, `soleus`, etc.). No es necesario renombrar ni modificar el GLB. Créditos y cautelas de redistribución en `public/models/ATTRIBUTION.md`.
Paso 3.3: Construir la página de Apuntar Ejercicios:
Estado: formulario, API y visor 3D integrados con fecha local, última sesión, guardado atómico, reintentos y eliminación. La segunda migración requiere aplicación en Supabase. El visor estático se ha comprobado en navegador; el flujo React completo y la interacción con Supabase siguen pendientes.
Detección del día de la semana.
Selector por píldoras de grupo muscular y desplegable del catálogo predefinido.
Integración del visor 3D al seleccionar el ejercicio.
Formulario rápido de series mostrando en gris los pesos de la sesión anterior (Ghost Data).
Paso 3.4: Construir el sistema de Cronómetro:
Estado: reloj global, pantalla, píldora y conexión de startRest al guardado confirmado de series implementados. La lógica de tiempo y persistencia está probada; lint/build y pruebas de navegador pendientes por falta de dependencias locales.
Crear un estado global (TimerContext + localStorage para que no se pare al bloquear el móvil).
Diseñar la Mini-Pill flotante superior que se activa sola al guardar una serie.
Diseñar la página dedicada de Cronómetro estilo Xiaomi.
Fase 4: Perfil, Detector de Fatiga, Historial, Recap y Rankings
Paso 4.1: Construir la página de Perfil:
Estado: pantalla, API autenticada y consulta SQL implementadas; avatar HTTPS, frases en JSON y resumen sin datos ficticios. Pruebas simuladas y contratos de permisos superados. Aplicación de la tercera migración y comprobación real en navegador/Supabase pendientes.
Campo para pegar y validar la URL de la foto de perfil.
Crear el archivo JSON con frases motivacionales de deportistas e integrarlo en la cabecera del perfil.
Tarjetas de resumen con últimos días entrenados y mejores ejercicios.
Paso 4.2: Programar el Detector Automático de Descarga/Fatiga:
Estado: finalización explícita y avisos conservadores STAGNATION_V1 implementados. Se exigen tres semanas consecutivas con al menos dos sesiones completadas por ejercicio y semana y la misma mejor serie por peso/repeticiones. No se infiere fatiga fisiológica ni se prescribe descarga; las bajadas o muestras escasas no generan aviso. Perfil permite leer avisos y consultar al Coach. Séptima migración y pruebas SQL preparadas; aplicación real, concurrencia y revisión visual pendientes.
Al finalizar un entrenamiento, comprobar si el usuario acumula 2-3 semanas sin subir peso/reps en ese ejercicio y crear el registro en ai_alerts para mostrar el aviso en su perfil.
Paso 4.3: Construir la página de Historial (Calendario): vista mensual con puntos rojos en los días entrenados y detalle completo al tocar cualquier fecha.
Estado: calendario y consulta autenticada implementados, accesibles desde Perfil y navegación de escritorio. Fechas locales, años bisiestos, navegación mensual, Hoy, selector de fecha y detalle por ejercicio. Pruebas de API, calendario y contrato SQL superadas; quinta migración e integración real en Supabase/navegador pendientes.
Paso 4.4: Construir la página de Recap (Semana / Mes / Año):
Estado: recap estadístico, API autenticada y mapa muscular 3D implementados; comparación por días transcurridos, rangos visibles, ceros reales y porcentajes sin división por cero. La sexta migración habilita el recap; la novena añade series por músculo, principales y secundarias separadas. Equivalencias y descompresión del modelo real, colores y contratos API/SQL probados. Aplicación y prueba real en Supabase y flujo React completo pendientes.
Consultas SQL comparativas entre periodos (diferencia de peso movido, series y días).
Gráficas minimalistas en rojo/blanco y mapa de calor muscular en el modelo 3D.
Paso 4.5: Construir la página de Rankings Globales:
Estado: pantalla y API autenticada implementadas, octava migración preparada. Participación voluntaria desactivada por defecto, alias y mejores series de sesiones finalizadas; filtros, empates, primeras posiciones, paginación y marca propia privada. Las marcas son declaradas, no verificadas. Pendientes: ejecutar SQL e integración real, rendimiento y revisión visual. La automatización de `is_pr` y el feed siguen pendientes.
Filtros rápidos por Categoría -> Ejercicio predefinido -> Switch (Peso Máximo vs Repeticiones).
Podio Top 3, lista general y barra inferior fija con la posición del usuario.
Fase 5: Entrenador IA (Groq) y Feed Social
Estado: pasos 5.2 y 5.3 implementados con transporte REST nativo, privacidad del contexto, límites de uso, reintento, edición y cancelación. Modelo fijo qwen/qwen3.8-27b, sin fallback. Pendientes: paso 5.1, cuarta migración, verificación real de Groq/Supabase y revisión visual. No se da por cerrada la fase ni se incluyen alertas calculadas todavía.
Paso 5.1: Crear cuenta en Groq Cloud, obtener la API Key y añadirla a las variables de entorno de Vercel.
Paso 5.2: Crear el endpoint /api/ai-coach que consulta en Supabase el resumen de las últimas 4 semanas del usuario y sus alertas de fatiga, inyectándolo en el System Prompt de Groq.
Paso 5.3: Diseñar la pantalla de Chat con la IA incluyendo botones rápidos para dudas frecuentes (estancamiento de pesos, dolores articulares, sugerencia de descarga).
Paso 5.4: (Opcional) Desarrollar la pantalla del Feed Social donde solo se pueden publicar tarjetas automáticas de entrenamientos terminados o nuevos PRs y dar reacciones rápidas (🔥).
