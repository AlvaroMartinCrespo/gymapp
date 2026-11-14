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

- [ ] 8. Red de seguridad del proyecto (secciones 11.6, 11.10, 11.11 y 12.1): CI con lint, `tsc --noEmit`, tests y build; cabeceras de seguridad; rate limiting en `/api/push/*`; `.gitignore` con `.DS_Store` y `__MACOSX`; eliminar `PagePlaceholder`. Casi todo son cambios pequeños y hacen que el resto de pasos se pueda validar solo en cada PR.
- [ ] 9. Menos código repetido (secciones 11.1, 11.2 y 11.3): `lib/format.ts` y `lib/api.ts`, un hook de datos común y dividir los componentes largos. Hace más baratos los pasos 10, 12 y 14.
- [ ] 10. Estados de carga, vacío y error uniformes (sección 8.3, 8.4 y 8.5): Skeletons, `EmptyState` con acción y errores con "Reintentar" usando los componentes ya creados.
- [ ] 11. Navegación en móvil (secciones 2.1, 2.3, 2.4, 2.5 y 9.5): menú "Más" para Coach e Historial, botón atrás coherente, título y acción en la cabecera fija, cronómetro como bottom sheet y safe areas en los elementos fijos.
- [ ] 12. Entrenar, segunda parte (secciones 4.2, 4.5, 4.6, 4.8, 4.9 y 8.7): barra de acción fija, selector de ejercicios con búsqueda, series como tarjetas con swipe, cabecera de sesión, resumen de cardio y actualizaciones optimistas.
- [x] ~~13. Consistencia visual pendiente (secciones 1.2, 1.3, 1.5, 1.7, 1.8, 1.9, 1.10 y 3.4): radios, colores sueltos de Rankings, más `Card`, escala tipográfica, cifras destacadas, iconos, elevación, movimiento y KPIs con tendencia.~~ ✅ (criterios en `docs/diseno.md`; la tendencia del Perfil necesita aplicar la migración `20261114000000_profile_overview_trend.sql`)
- [ ] 14. Acceso y cuenta (sección 7): marca en la pantalla de acceso, recuperar contraseña, fuerza de contraseña, reenviar confirmación, y eliminar cuenta y exportar datos (RGPD).
- [ ] 15. Coach IA (sección 6): burbujas, Markdown, barra de entrada fija, streaming, conversación persistente y aviso de privacidad. Los puntos de persistencia y streaming tocan la API.
- [ ] 16. Historial, Rankings y récords (secciones 5.2 a 5.6, 4.7 y 3.3): calendario por intensidad, podio, filtros, switch de participación, resumen compartible, y las migraciones que calculan `is_pr` y la racha.
- [ ] 17. PWA, rendimiento y accesibilidad restante (secciones 10 y 9.2 a 9.4): modo offline con cola de series, manifest completo, aviso de instalación, modelo 3D más ligero, splash de iOS, contraste, tema claro y haptics.
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

- [ ] **Móvil: Coach e Historial escondidos.** La barra inferior solo tiene 5 de 7 secciones. Menú "Más" o integrar Historial en Recap como pestaña.
- [x] ~~**Cabecera duplicada.** Mover `AuthStatus` a un menú de avatar (Perfil, Ajustes, Cerrar sesión).~~ Hecho con Perfil y Cerrar sesión; "Ajustes" no existe todavía como pantalla.
- [ ] **Cabecera sticky compacta.** Título de página, acción principal y avatar en una barra fija pequeña. Nota: la barra ya es fija (logo en móvil + menú de avatar, respetando el notch); falta el título de página y la acción principal.
- [ ] **Cronómetro como panel/bottom sheet.** Ya existe la píldora global; liberar un hueco en la barra inferior.
- [ ] **Botón "atrás" coherente.** Coach lo tiene solo en móvil; Historial y Recap tienen cada uno el suyo.
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
- [ ] **Modo gimnasio con una mano.** Barra de acción fija abajo con "Guardar serie" y peso/reps en una tarjeta compacta.
- [x] ~~**Steppers de peso y repeticiones** (±2,5 kg y ±1 rep).~~ Hecho: `training/number-stepper.tsx`; si el campo está vacío parten del valor de la sesión anterior.
- [x] ~~**Chips de selección rápida.** "Repetir anterior", "+2,5 kg", "Misma serie".~~ Hecho.
- [ ] **Selector de ejercicios con búsqueda** y recientes/favoritos, en lugar de `<select>` nativos (51 ejercicios).
- [ ] **Series como lista de tarjetas** con swipe para borrar, en lugar de tabla.
- [ ] **Distintivo de récord (PR)** visible al guardar una serie, con animación breve. Nota: ninguna función SQL calcula hoy `is_pr` (siempre es `false`), así que antes hace falta una migración que lo calcule.
- [ ] **Cabecera de sesión.** Duración, series totales y volumen en vivo, y botón "Finalizar" visible.
- [ ] **Cardio.** Resumen de la sesión en curso en una tarjeta para acortar el contenido.

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
- [ ] **Skeletons** en lugar de "Cargando..." con spinner.
- [ ] **Estados vacíos** con ilustración y botón de acción ("Registra tu primer entreno").
- [ ] **Errores con acción** ("Reintentar") de forma uniforme en todas las pantallas.
- [ ] **Pull-to-refresh** o actualización automática en lugar de botones "Actualizar".
- [ ] **Actualizaciones optimistas** al guardar o borrar series, con rollback si falla.

## 9. Accesibilidad y móvil

- [x] ~~**Quitar `maximumScale: 1`** (bloquea el zoom, fallo WCAG). Mantener `font-size: 16px` en inputs para evitar el zoom de iOS.~~ Hecho en `layout.tsx`. Todos los campos son `text-base` (16 px); el único que no lo era, el selector de descanso de Entrenar, ya lo es.
- [ ] **Contraste.** Comprobar que `#a1a1aa` sobre `#18181b` en `text-xs` llega a 4,5:1.
- [ ] **Tema claro opcional** o modo "automático" (hoy el dark está forzado).
- [ ] **Haptics** (`navigator.vibrate`) al guardar o terminar el descanso en Android.
- [ ] **Safe areas** en la píldora del cronómetro y en los elementos fijos.

## 10. PWA y rendimiento

- [ ] **Modo offline real.** Cachear shell y estáticos y añadir cola de series pendientes.
- [ ] **Manifest más completo.** `shortcuts` (Entrenar, Cronómetro), `screenshots` y `categories: ["health","fitness"]`.
- [ ] **Aviso "Instalar app"** en navegadores compatibles y guía para iOS.
- [ ] **Peso del modelo 3D.** `human_muscles.glb` (~6 MB): comprimir con Draco/meshopt, texturas ligeras, carga lazy y póster estático.
- [ ] **Visor 3D en iframe.** Que el fallback sea una imagen y no solo un mensaje.
- [ ] **Splash screens de iOS** y color de la barra de estado coherentes.

## 11. Calidad de código y proceso

- [ ] **Código duplicado.** Mover `localDate`, `subscribeDate`, `formatDate`, `dateLabel`, `numberLabel`, `formatNumber` y el fetch a `lib/format.ts` y `lib/api.ts`.
- [ ] **Dividir componentes largos** (`SetTable`, `SetForm`, `DaySummary`, `StatGrid`).
- [ ] **Hook de datos común** (`useApi`, SWR o React Query) en vez de repetir view/queryKey/AbortController.
- [ ] **Eliminar `PagePlaceholder`** si no se usa.
- [ ] **Centralizar textos** en español.
- [ ] **CI (GitHub Actions)** con lint, `tsc --noEmit`, `npm test` y build en cada PR.
- [ ] **Tests de interfaz (Playwright)** para acceso, guardar serie y finalizar.
- [ ] **Observabilidad.** Sentry o similar y analítica respetuosa con la privacidad.
- [ ] **Rate limiting** en `/api/push/schedule` y `/api/push/cancel`.
- [ ] **Cabeceras de seguridad** en `next.config.ts` (CSP global, X-Frame-Options, Referrer-Policy, Permissions-Policy).

## 12. Repositorio y documentación

- [ ] **Limpieza del repo.** Añadir `.DS_Store` y `__MACOSX` al `.gitignore` y no subirlos.
- [ ] **Dividir el README** (36 KB): uno corto y el detalle técnico en `docs/`.
- [ ] **Mover `plan.md` y `AGENTS.md`** a `docs/` o fuera del repositorio público.
- [ ] **Actualizar el estado de fases** en el plan.
- [ ] **Licencia, CONTRIBUTING, CHANGELOG** y política de privacidad y términos dentro de la app.
