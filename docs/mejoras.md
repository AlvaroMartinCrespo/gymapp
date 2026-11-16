# Mejoras pendientes

Marca cada casilla con `[x]` cuando esté hecha.

## Orden recomendado (para que se note rápido)

- [x] ~~1. Colores semánticos y componentes base (secciones 1.1, 1.4 y 1.6)~~ ✅
- [x] ~~2. Diálogos y toasts en lugar de `confirm` y mensajes en línea (sección 8)~~ ✅
- [x] ~~3. Reordenar Entrenar para móvil (sección 4)~~ ✅ (parcial: ver notas en la sección 4)
- [x] ~~4. Reorganizar Perfil y la cabecera (secciones 2 y 3)~~ ✅ (parcial: ver notas)
- [x] ~~5. Gráficas reales en Recap (sección 5)~~ ✅
- [x] ~~6. Páginas 404 y de error (sección 2)~~ ✅
- [x] ~~7. Quitar `maximumScale` (sección 9)~~ ✅

## Segundo orden recomendado (lo que queda)

Mismo criterio: primero lo barato que protege el trabajo hecho, después lo que más se nota en el uso diario. Los números entre paréntesis son `sección.punto` (la posición del punto dentro de su sección).

- [x] ~~8. Red de seguridad del proyecto (secciones 11.6, 11.10, 11.11 y 12.1): CI con lint, `tsc --noEmit`, tests y build; cabeceras de seguridad; rate limiting en `/api/push/*`; `.gitignore` con `.DS_Store` y `__MACOSX`; eliminar `PagePlaceholder`.~~ ✅ (CI en `.github/workflows/ci.yml`; CSP y resto de cabeceras en `src/lib/security-headers.mjs`; límite en `src/lib/rate-limit.mjs`. Si la CSP bloquea algo en producción, `CSP_REPORT_ONLY=1` la deja en modo aviso mientras se corrige)
- [x] ~~9. Menos código repetido (secciones 11.1, 11.2 y 11.3): `lib/format.ts` y `lib/api.ts`, un hook de datos común y dividir los componentes largos.~~ ✅ (`lib/format.ts`, `lib/api.ts`, `lib/use-api.ts` y `lib/use-local-date.ts`; `TrainingPanel` dividido en `ExercisePicker`, `SetForm`, `SetTable` y `DaySummary`)
- [x] ~~10. Estados de carga, vacío y error uniformes (sección 8.3, 8.4 y 8.5): Skeletons, `EmptyState` con acción y errores con "Reintentar" usando los componentes ya creados.~~ ✅ (`SkeletonGroup` y `SkeletonList` en `ui/skeleton.tsx`, `ErrorState` en `ui/error-state.tsx` y `EmptyState compact`; aplicado en Perfil, Avisos, Historial, Recap, Rankings, Series de hoy y Cardio. Quedan fuera el Coach (punto 15), el visor 3D (punto 17) y los mensajes de los botones en curso)
- [x] ~~11. Navegación en móvil (secciones 2.1, 2.3, 2.4, 2.5 y 9.5): menú "Más" para Coach e Historial, botón atrás coherente, título y acción en la cabecera fija, cronómetro como bottom sheet y safe areas en los elementos fijos.~~ ✅ (barra inferior con Perfil, Entrenar, Recap, Rankings y "Más" —Cronómetro, Coach IA e Historial—; `ui/sheet.tsx` es la hoja inferior, con asa para arrastrar y área segura; la cabecera fija `layout/app-header.tsx` muestra atrás/logo, título y la acción de cada pantalla, que se declara con `<HeaderAction>`; en móvil la píldora del cronómetro y "Más → Cronómetro" abren `timer/timer-sheet.tsx`, en escritorio sigue la página `/cronometro`)
- [x] ~~12. Entrenar, segunda parte (secciones 4.2, 4.5, 4.6, 4.8, 4.9 y 8.7): barra de acción fija, selector de ejercicios con búsqueda, series como tarjetas con swipe, cabecera de sesión, resumen de cardio y actualizaciones optimistas.~~ ✅ (barra fija sobre la barra inferior en móvil dentro de `SetForm`; `training/exercise-search.tsx` con búsqueda sin tildes, favoritos y recientes en `localStorage` (`exercise-prefs.ts`); `set-card.tsx` con swipe a la izquierda que pide confirmar el borrado; `session-header.tsx` con duración, series, volumen y Finalizar; resumen y "Más datos" plegable en Cardio; guardar y borrar series son optimistas con rollback. Las actualizaciones optimistas de Cardio y el paso de Entrenar/Cardio/Rankings a `useApi` quedan pendientes)
- [x] ~~13. Consistencia visual pendiente (secciones 1.2, 1.3, 1.5, 1.7, 1.8, 1.9, 1.10 y 3.4): radios, colores sueltos de Rankings, más `Card`, escala tipográfica, cifras destacadas, iconos, elevación, movimiento y KPIs con tendencia.~~ ✅ (criterios en `docs/diseno.md`; la tendencia del Perfil necesita aplicar la migración `20261114000000_profile_overview_trend.sql`)
- [ ] 14. Acceso y cuenta (sección 7): marca en la pantalla de acceso, recuperar contraseña, fuerza de contraseña, reenviar confirmación, y eliminar cuenta y exportar datos (RGPD).
- [ ] 15. Coach IA (sección 6): burbujas, Markdown, barra de entrada fija, streaming, conversación persistente y aviso de privacidad. Los puntos de persistencia y streaming tocan la API.
- [ ] 16. Historial, Rankings y récords (secciones 5.2 a 5.6, 4.7 y 3.3): calendario por intensidad, podio, filtros, switch de participación, resumen compartible, y las migraciones que calculan `is_pr` y la racha.
- [ ] 17. PWA, rendimiento y accesibilidad restante (secciones 10 y 9.2 a 9.4): modo offline con cola de series, aviso de instalación, contraste, tema claro y haptics. (Hechos de la sección 10: modelo 3D más ligero, fallback con imagen del visor, manifest completo y splash de iOS.)
- [ ] 18. Documentación y legal (sección 12.2 a 12.5): dividir el README, mover `plan.md` y `AGENTS.md`, actualizar fases, licencia, CONTRIBUTING, CHANGELOG y política de privacidad y términos.

---

## 1. Sistema de diseño y consistencia visual

- [x] ~~**Colores semánticos.** Los errores usan `text-primary` (el rojo de marca), igual que un elemento activo. Existe `--destructive` pero no se usa. Definir success, warning, error e info separados del rojo de marca.~~ Hecho: tokens `--success`, `--warning`, `--error` e `--info` (con su `-foreground`) en `globals.css`; `--destructive` se usa en `Button variant="destructive"`; los mensajes de error, aviso y éxito usan `Alert` en vez de `text-primary`.
- [x] ~~**Radios inconsistentes.** Elegir un criterio: tarjetas `2xl`, controles `xl`, chips `full`.~~ Hecho: tarjetas, diálogos y menús `rounded-2xl`; botones, campos, selects, avisos y toasts `rounded-xl`; chips, insignias y avatares `rounded-full`. La única excepción es el `TabsTrigger`, que va un escalón por debajo de su `TabsList`.
- [x] ~~**Colores sueltos fuera del tema.** Rankings usa `text-amber-500`, `text-zinc-400`, `text-rose-600` y `accent-red-600`. Pasarlos a variables (`--gold`, `--silver`, `--bronze`).~~ Hecho: tokens `--gold`, `--silver` y `--bronze` (`text-gold`, `text-silver`, `text-bronze`) y `accent-primary` en el checkbox. Ya no queda ningún color de paleta suelto en `src/`.
- [x] ~~**Selects y campos inconsistentes.** Rankings usa `bg-background h-11 rounded-md`; el resto `bg-card h-12 rounded-lg`. Crear `Input`, `Select`, `Label` y `Field` en `components/ui` y usarlos en todas partes.~~ Hecho: `input.tsx`, `select.tsx` y `field.tsx` (`Label` + `Field`); sustituyen a todos los `inputClass` y `<select>` sueltos (Entrenar, Cardio, Conversor, Acceso, Rankings, Perfil, Historial, Recap y Cronómetro).
- [x] ~~**Usar más `Card`.** Agrupar con tarjetas (fondo, borde sutil, padding) en lugar de bloques con `border-y` y `section-divider`.~~ Hecho en Perfil, Recap, Historial, Rankings, Coach, Entrenar, Cardio, Conversor y Cronómetro. Se eliminan `section-divider` y todos los `border-y`.
- [x] ~~**Componentes base que faltan.** Añadir `Badge`, `Tabs`, `Dialog`, `Skeleton`, `Toast`, `Progress`, `Tooltip`, `EmptyState` y `Stat`.~~ Hecho (más `Alert`) en `src/components/ui/`. `Tabs` ya se usa en Entrenar, `Stat` en el resumen del día y `ToastProvider` está montado en `AppShell`. `Dialog`, `Toast`, `Skeleton` y `EmptyState` se estrenan en los puntos 2 y 8.
- [x] ~~**Escala tipográfica.** Jerarquía fija (página, sección, tarjeta, dato, etiqueta) con una clase por nivel.~~ Hecho: `type-page`, `type-section` (sustituye a `section-heading`), `type-card`, `type-data` y `type-label` en `globals.css`. Todos los `h1` usan `type-page`.
- [x] ~~**Cifras destacadas.** Fuente mono consistente con `tabular-nums` y tamaños grandes para los KPIs.~~ Hecho: `type-kpi` y `type-kpi-lg` (mono, cifras tabulares) en `Stat`, que ahora también usan Recap e Historial; `type-data` para los datos de listas y tablas.
- [x] ~~**Iconografía uniforme.** Fijar `strokeWidth` y tamaños (16/20/24) en vez de `size-4`, `size-5` y `size-6` sin criterio.~~ Hecho: trazo único `--icon-stroke` para todo `.lucide`; `size-4` en texto y botones, `size-5` en cabeceras de sección y `size-6` en avatares y botón del cronómetro. Desaparecen `size-3` y `size-7`.
- [x] ~~**Elevación y profundidad.** 2 o 3 niveles (fondo, tarjeta, tarjeta elevada) con bordes de 1 px y degradado muy sutil.~~ Hecho: `surface-1` (`Card`) y `surface-2` (`Card elevation={2}`, menú de cuenta, diálogos, toasts, tooltip y la barra fija de Rankings).
- [x] ~~**Movimiento coherente.** Duraciones y easing comunes, respetando `prefers-reduced-motion`.~~ Hecho: `--ease-standard` y 200 ms por defecto en cualquier `transition-*` (150 ms rápido, 300 ms lento). Con `prefers-reduced-motion` se anula todo salvo los indicadores de carga.

## 2. Navegación y estructura

- [x] ~~**Móvil: Coach e Historial escondidos.** La barra inferior solo tiene 5 de 7 secciones. Menú "Más" o integrar Historial en Recap como pestaña.~~ Hecho: menú "Más" (`layout/more-menu.tsx`) con Cronómetro, Coach IA e Historial.
- [x] ~~**Cabecera duplicada.** Mover `AuthStatus` a un menú de avatar (Perfil, Ajustes, Cerrar sesión).~~ Hecho con Perfil y Cerrar sesión; "Ajustes" no existe todavía como pantalla.
- [x] ~~**Cabecera sticky compacta.** Título de página, acción principal y avatar en una barra fija pequeña.~~ Hecho: título en móvil y acción de la pantalla (Coach: nueva conversación; Historial y Recap: actualizar; Recap: acceso a Historial) en `AppHeader`.
- [x] ~~**Cronómetro como panel/bottom sheet.** Ya existe la píldora global; liberar un hueco en la barra inferior.~~ Hecho en móvil: hoja inferior desde la píldora y desde "Más"; el hueco lo ocupa "Más".
- [x] ~~**Botón "atrás" coherente.** Coach lo tiene solo en móvil; Historial y Recap tienen cada uno el suyo.~~ Hecho: un único botón en la cabecera (solo móvil, en Coach e Historial). Vuelve con `router.back()` si ya se navegó dentro de la app y, si no (entrada directa), al Perfil.
- [ ] **Sidebar de escritorio.** Pie con usuario, versión y estado de sincronización; poder colapsarla a solo iconos.
- [ ] **Aprovechar escritorio.** Dejar `max-w-3xl` y usar dos columnas (Entrenar: formulario + visor 3D; Perfil como dashboard de 2 o 3 columnas).
- [x] ~~**Páginas 404 y de error.** Añadir `not-found.tsx`, `error.tsx`, `global-error.tsx` y `loading.tsx`.~~ Hecho en `src/app/`. `loading.tsx` es genérico (cabecera, tarjetas); las pantallas con carga propia siguen usando su estado interno hasta el punto de Skeletons.

## 3. Pantalla de Perfil (inicio)

- [x] ~~**Priorizar lo importante.** KPIs y actividad primero; la frase en una tarjeta más pequeña.~~ Hecho.
- [x] ~~**Mover el formulario de la foto** a Ajustes o a un diálogo "Editar perfil".~~ Hecho: diálogo "Editar perfil" (botón del lápiz).
- [ ] **Tarjeta de cabecera** con saludo, avatar, alias, antigüedad ("Miembro desde…"), racha y objetivo semanal. Nota: hecho saludo, avatar, alias, correo y antigüedad; la racha y el objetivo semanal requieren datos nuevos en la API de perfil.
- [x] ~~**KPIs con tendencia.** Flecha y porcentaje frente al periodo anterior, como en Recap.~~ Hecho: `Stat` acepta `trend` y se usa en Perfil (frente a los 28 días anteriores) y en Recap. `get_profile_overview` devuelve `previous` con una migración nueva; si aún no está aplicada, el Perfil funciona igual sin flechas.
- [x] ~~**Gráfica de actividad más informativa.** Tooltip o valor encima, resaltar hoy y altura mínima para días vacíos.~~ Hecho: valor encima, hoy resaltado y barra mínima en días vacíos.
- [x] ~~**Alertas de entrenamiento** (`training-alerts`) con componente de aviso e icono ámbar, no solo texto rojo.~~ Hecho. Además, `TrainingAlerts` llevaba sin mostrarse en ningún sitio desde el commit "estilos"; ahora vuelve a aparecer en el Perfil.
- [x] ~~**Accesos rápidos "Asistente" e "Historial"** en una fila de iconos con etiqueta.~~ Hecho (más Recap).

## 4. Pantalla Entrenar

- [x] ~~**Formulario arriba en móvil.** Visor 3D plegable o más pequeño; el formulario de nueva serie antes que conversor y tabla.~~ Hecho: orden Ejercicio → Nueva serie → Series de hoy → Finalizar → visor 3D (plegable, se carga al abrirlo) → conversor → resumen del día.
- [x] ~~**Modo gimnasio con una mano.** Barra de acción fija abajo con "Guardar serie" y peso/reps en una tarjeta compacta.~~ Hecho en móvil: barra fija sobre la barra inferior con "Serie N · peso × reps" y el botón de guardar; en escritorio el botón sigue en el formulario.
- [x] ~~**Steppers de peso y repeticiones** (±2,5 kg y ±1 rep).~~ Hecho: `training/number-stepper.tsx`; si el campo está vacío parten del valor de la sesión anterior.
- [x] ~~**Chips de selección rápida.** "Repetir anterior", "+2,5 kg", "Misma serie".~~ Hecho.
- [x] ~~**Selector de ejercicios con búsqueda** y recientes/favoritos, en lugar de `<select>` nativos (51 ejercicios).~~ Hecho: hoja con buscador (ignora tildes), favoritos (estrella) y recientes, y el resto agrupado por grupo muscular. Los chips de grupo siguen como atajo.
- [x] ~~**Series como lista de tarjetas** con swipe para borrar, en lugar de tabla.~~ Hecho: `SetCard`; deslizar más de 80 px abre el diálogo de confirmación y el botón de papelera sigue disponible para teclado y escritorio.
- [ ] **Distintivo de récord (PR)** visible al guardar una serie, con animación breve. Nota: ninguna función SQL calcula hoy `is_pr` (siempre es `false`), así que antes hace falta una migración que lo calcule.
- [x] ~~**Cabecera de sesión.** Duración, series totales y volumen en vivo, y botón "Finalizar" visible.~~ Hecho: series y volumen son los de todo el día. La duración cuenta desde la primera serie guardada en este navegador (los datos no guardan hora), así que es "—" si el día se empezó en otro dispositivo.
- [x] ~~**Cardio.** Resumen de la sesión en curso en una tarjeta para acortar el contenido.~~ Hecho: tarjeta con duración, distancia, ritmo y calorías (estimadas o escritas), y RPE, pulso y calorías plegados en "Más datos".

## 5. Recap, Historial y Rankings

- [x] ~~**Gráficas reales en Recap.** Gráfico de columnas (Recharts) con tooltip en lugar de 30 filas de barras horizontales.~~ Hecho con un componente propio sin dependencias (`ui/column-chart.tsx`) en vez de Recharts, para no tocar `package.json` ni el lockfile; el detalle aparece en una línea fija al pasar, enfocar o tocar una columna, con navegación por flechas.
- [ ] **Calendario del Historial.** Intensidad por color según volumen y marcar los días de solo cardio.
- [ ] **Resumen compartible.** Tarjeta resumen exportable como imagen.
- [ ] **Rankings: podio visual** para los tres primeros, avatares más grandes y "Tu mejor serie" menos pesada.
- [ ] **Rankings: filtro** por periodo o amigos, y estado vacío con ilustración y llamada a la acción.
- [ ] **Estado de participación.** Cambiar el checkbox por un switch con breve explicación de privacidad.

## 6. Coach IA

- [ ] **Burbujas de chat** diferenciadas, con avatar del coach y marca de tiempo.
- [ ] **Renderizar Markdown** en las respuestas (hoy `whitespace-pre-wrap`).
- [ ] **Barra de entrada fija abajo,** con altura auto-ajustable y envío con Intro.
- [ ] **Efecto de escritura/streaming** en lugar de "Consultando...".
- [ ] **Conversación persistente** (hoy se pierde al salir).
- [ ] **Aviso de privacidad** discreto con icono de información en la cabecera.

## 7. Acceso (login/registro)

- [ ] **Más presencia de marca.** Logo, eslogan, fondo con degradado y tarjeta centrada.
- [ ] **Recuperar contraseña** ("¿Olvidaste tu contraseña?").
- [ ] **Indicador de fuerza de contraseña** y validación en línea.
- [ ] **Reenviar correo de confirmación** y estados claros tras registrarse.
- [ ] **Eliminar cuenta y exportar mis datos** (RGPD).

## 8. Feedback y estados

- [x] ~~**Sustituir `window.confirm`** por diálogos propios (eliminar serie, finalizar, descartar cronómetros, borrar cardio).~~ Hecho: `ConfirmProvider` y `useConfirm()` (`ui/confirm-dialog.tsx`, montado en `AppShell`) devuelven una promesa: `if (!(await confirm({ title, destructive: true }))) return;`.
- [x] ~~**Toasts** para "Serie guardada", "Foto actualizada", etc.~~ Hecho en Entrenar (guardar, eliminar, finalizar), Cardio (guardar, editar, eliminar, aviso de 24 h) y Perfil (foto). Los errores siguen en línea con `Alert`, y los mensajes de Acceso también (se leen antes de iniciar sesión).
- [x] ~~**Skeletons** en lugar de "Cargando..." con spinner.~~ Hecho: `SkeletonGroup` (zona con `role="status"`, `aria-busy` y texto accesible) y `SkeletonList` (filas de altura fija) sustituyen al spinner con texto en Perfil, Avisos, Historial, Recap (también el resumen del entrenador), Rankings, Series de hoy y Cardio. `app/loading.tsx` usa `SkeletonGroup`. Los spinners se mantienen en botones en curso, en los botones de actualizar y en el visor 3D (punto 17); el Coach sigue con "Consultando..." hasta el punto 15.
- [x] ~~**Estados vacíos** con ilustración y botón de acción ("Registra tu primer entreno").~~ Hecho con `EmptyState` (icono en vez de ilustración; la variante `compact` es para vacíos dentro de una tarjeta con título). Con acción: Perfil (últimos entrenamientos → "Registrar mi primer entreno"), Historial (día sin series → Entrenar), Recap (periodo sin series → Entrenar) y Rankings (sin marcas → Entrenar, o "Activar participación" si está desactivada; página vacía → volver a la primera). Sin acción, porque el formulario está justo encima: Series de hoy, Cardio, Mejores marcas y Avisos.
- [x] ~~**Errores con acción** ("Reintentar") de forma uniforme en todas las pantallas.~~ Hecho con `ErrorState` (`Alert` + "Reintentar", o "Iniciar sesión" si la API devuelve 401, porque reintentar no serviría). Lo usan Perfil, Avisos, Historial, Recap, Rankings, Series de hoy y Cardio; el resumen del entrenador de Recap reintenta solo esa petición. El Coach ya tenía su propio "Reintentar". Los errores de acciones (guardar, borrar) siguen en línea con `Alert`, porque ahí el reintento ya está en el propio formulario.
- [ ] **Pull-to-refresh** o actualización automática en lugar de botones "Actualizar".
- [x] ~~**Actualizaciones optimistas** al guardar o borrar series, con rollback si falla.~~ Hecho en Entrenar: la serie aparece (atenuada con spinner hasta confirmarse) y el formulario se vacía al instante; si falla se quita y se restauran peso y repeticiones. Ya no se vuelve a pedir la lista tras cada cambio (no parpadean los skeletons). Cardio sigue sin ser optimista.

## 9. Accesibilidad y móvil

- [x] ~~**Quitar `maximumScale: 1`** (bloquea el zoom, fallo WCAG). Mantener `font-size: 16px` en inputs para evitar el zoom de iOS.~~ Hecho en `layout.tsx`. Todos los campos son `text-base` (16 px); el único que no lo era, el selector de descanso de Entrenar, ya lo es.
- [ ] **Contraste.** Comprobar que `#a1a1aa` sobre `#18181b` en `text-xs` llega a 4,5:1.
- [ ] **Tema claro opcional** o modo "automático" (hoy el dark está forzado).
- [ ] **Haptics** (`navigator.vibrate`) al guardar o terminar el descanso en Android.
- [x] ~~**Safe areas** en la píldora del cronómetro y en los elementos fijos.~~ Hecho: laterales en contenido, cabecera, barra inferior y píldoras; inferior en la barra de Rankings, los toasts y la hoja.

## 10. PWA y rendimiento

- [ ] **Modo offline real.** Cachear shell y estáticos y añadir cola de series pendientes.
- [x] ~~**Manifest más completo.** `shortcuts` (Entrenar, Cronómetro), `screenshots` y `categories: ["health","fitness"]`.~~ Hecho en `src/app/manifest.ts`: `categories`, `lang: "es"`, dos `shortcuts` (`/entrenar` y `/cronometro`, con el icono de 192) y tres `screenshots` (dos `narrow` y una `wide`, 720×1280 y 1280×720 en `public/screenshots/`). Pendiente: las capturas son ilustraciones dibujadas con `scripts/screenshots/render-screenshots.py` (colores, textos y póster reales, pero no salen del navegador); conviene sustituirlas por capturas reales con los mismos nombres y tamaños (el test `scripts/pwa.test.mjs` comprueba que las dimensiones coinciden con las del manifest). Los accesos directos solo los ofrece Chrome/Android y algunos navegadores de escritorio; iOS los ignora.
- [ ] **Aviso "Instalar app"** en navegadores compatibles y guía para iOS.
- [x] ~~**Peso del modelo 3D.** `human_muscles.glb` (~6 MB): comprimir con Draco/meshopt, texturas ligeras, carga lazy y póster estático.~~ Hecho: el GLB pasa de 6,0 a 3,7 MB (−38 %) y de 985 k a 605 k triángulos. Ya venía con meshopt y sin texturas, así que no había nada que pasar a Draco (el visor no incluye su decodificador) ni texturas que aligerar; el ahorro sale de quitar `COLOR_0` (el visor sustituye los materiales y nunca lo lee) y de simplificar las mallas (las cajas de cada malla se mueven como mucho un 0,15 % de la altura; mismas 634 mallas, nombres y metadatos de licencia). Se reproduce con `scripts/model/`. El visor muestra un póster WebP (4-5 KB, frente o espalda según `camera`) hasta que el modelo está listo; con ahorro de datos o red 2G/3G el iframe no se monta hasta pulsar «Cargar modelo 3D»; el GLB se precarga en paralelo a los módulos y `/models/*` y los pósters se sirven con caché de una semana. Pendiente de comprobar: (1) no se ha probado en navegador, solo la carga del GLB con el `GLTFLoader` y el decodificador meshopt del proyecto en Node; (2) `navigator.connection` no existe en Safari/iOS, donde el modelo siempre se carga solo; (3) con gzip el GLB baja a ≈ 2,5 MB: `next start` ya lo comprime, en el hosting de producción hay que comprobarlo (`curl -I -H "Accept-Encoding: gzip, br"`); (4) el póster solo cubre la espera, que también sirva de fallback si falla el visor es el punto siguiente.
- [x] ~~**Visor 3D en iframe.** Que el fallback sea una imagen y no solo un mensaje.~~ Hecho: si el visor falla (WebGL no disponible, error del iframe o 45 s sin cargar) el póster WebP se queda como imagen de respaldo, atenuado al 40 %, con el aviso y «Reintentar» encima; el iframe se desmonta para que no quede un visor roto. Debajo siguen las listas de músculos principales y secundarios, que no dependen del modelo. Pendiente de comprobar en navegador: forzar el error (p. ej. desactivando WebGL) y ver que el aviso se lee sobre el póster; el póster es neutro (no resalta los músculos del ejercicio).
- [x] ~~**Splash screens de iOS** y color de la barra de estado coherentes.~~ Hecho: `src/lib/splash-screens.mjs` lista 21 pantallas verticales (iPhone SE/8 hasta 16 Pro Max e iPad mini/Air/Pro); `scripts/generate-icons.mjs` genera un PNG por cada una en `public/splash/` (fondo `#09090b` con la mascota centrada, sin versionar, como los iconos) y `src/app/layout.tsx` las declara con `appleWebApp.startupImage` y su `media` exacto. La barra de estado se queda en `black-translucent`, y `--background`, `themeColor`, `theme_color`, `background_color` y las splash comparten `#09090b` (lo vigila `scripts/pwa.test.mjs`). Pendiente de comprobar en un iPhone/iPad reales: iOS cachea la splash al añadir la app a Inicio, así que hay que quitarla y volver a añadirla; los modelos nuevos que no estén en la lista mostrarán blanco hasta que se añadan; no hay splash horizontales porque el manifest fija `portrait`.

## 11. Calidad de código y proceso

- [x] ~~**Código duplicado.** Mover `localDate`, `subscribeDate`, `formatDate`, `dateLabel`, `numberLabel`, `formatNumber` y el fetch a `lib/format.ts` y `lib/api.ts`.~~ Hecho. `formatDate(fecha, estilo)` y `formatNumber(valor, opciones)` sustituyen a todas las copias (también `Stat`, Rankings, Cardio y el conversor); `localDate` y `subscribeDate` quedan en `useLocalDate()` (la fecha canónica sigue siendo `localHistoryDate` de `lib/history.ts`); `postJson` (no lanza) y `requestJson` (lanza) sustituyen a `profileRequest`, `workoutRequest` y `cardioRequest`. Quedan fuera de `postJson` los `fetch` del Coach, Acceso, avisos y el cronómetro.
- [x] ~~**Dividir componentes largos** (`SetTable`, `SetForm`, `DaySummary`, `StatGrid`).~~ Hecho para `SetTable`, `SetForm` y `DaySummary` (más `ExercisePicker`), en `components/training/`. `StatGrid` no existe en el código. `CardioPanel` (~370 líneas) sigue sin dividir y es el candidato para el punto 12.
- [x] ~~**Hook de datos común** (`useApi`, SWR o React Query) en vez de repetir view/queryKey/AbortController.~~ Hecho con `useApi` propio (`lib/use-api.ts`, sin dependencias nuevas) en Historial, Recap y Perfil. Entrenar, Cardio y Rankings siguen con su propio estado porque modifican los datos cargados (series, lista, participación); pasarán a `useApi` con las actualizaciones optimistas del punto 12.
- [x] ~~**Eliminar `PagePlaceholder`** si no se usa.~~ Hecho: no lo importaba nadie y se borra `components/layout/page-placeholder.tsx`.
- [ ] **Centralizar textos** en español.
- [x] ~~**CI (GitHub Actions)** con lint, `tsc --noEmit`, `npm test` y build en cada PR.~~ Hecho en `.github/workflows/ci.yml` (Node 22, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`). El build usa variables de relleno; si algún día se conecta a un servicio al compilar, habrá que añadirlas como secretos del repositorio.
- [ ] **Tests de interfaz (Playwright)** para acceso, guardar serie y finalizar.
- [ ] **Observabilidad.** Sentry o similar y analítica respetuosa con la privacidad.
- [x] ~~**Rate limiting** en `/api/push/schedule` y `/api/push/cancel`.~~ Hecho: 30 peticiones por minuto e IP en cada ruta (429 con `Retry-After`). Es un contador en memoria, por instancia: frena ráfagas, pero no es un tope global. Para uno global habría que usar un almacén compartido (p. ej. Upstash Redis) con la misma interfaz.
- [x] ~~**Cabeceras de seguridad** en `next.config.ts` (CSP global, X-Frame-Options, Referrer-Policy, Permissions-Policy).~~ Hecho (más `X-Content-Type-Options` y HSTS), salvo en `/sw.js`, que conserva su CSP propia. La CSP necesita `'unsafe-inline'` en scripts y estilos por cómo Next.js prerenderiza; endurecerla con nonces queda pendiente.

## 12. Repositorio y documentación

- [x] ~~**Limpieza del repo.** Añadir `.DS_Store` y `__MACOSX` al `.gitignore` y no subirlos.~~ Hecho (también `._*` y `Thumbs.db`); `.DS_Store` ya no estaba en git y se borra del árbol.
- [ ] **Dividir el README** (36 KB): uno corto y el detalle técnico en `docs/`.
- [ ] **Mover `plan.md` y `AGENTS.md`** a `docs/` o fuera del repositorio público.
- [ ] **Actualizar el estado de fases** en el plan.
- [ ] **Licencia, CONTRIBUTING, CHANGELOG** y política de privacidad y términos dentro de la app.
