# Mejoras pendientes

Marca cada casilla con `[x]` cuando esté hecha.

## Orden recomendado (para que se note rápido)

- [ ] 1. Colores semánticos y componentes base (secciones 1.1, 1.4 y 1.6)
- [ ] 2. Diálogos y toasts en lugar de `confirm` y mensajes en línea (sección 8)
- [ ] 3. Reordenar Entrenar para móvil (sección 4)
- [ ] 4. Reorganizar Perfil y la cabecera (secciones 2 y 3)
- [ ] 5. Gráficas reales en Recap (sección 5)
- [ ] 6. Páginas 404 y de error (sección 2)
- [ ] 7. Quitar `maximumScale` (sección 9)

---

## 1. Sistema de diseño y consistencia visual

- [ ] **Colores semánticos.** Los errores usan `text-primary` (el rojo de marca), igual que un elemento activo. Existe `--destructive` pero no se usa. Definir success, warning, error e info separados del rojo de marca.
- [ ] **Radios inconsistentes.** Elegir un criterio: tarjetas `2xl`, controles `xl`, chips `full`.
- [ ] **Colores sueltos fuera del tema.** Rankings usa `text-amber-500`, `text-zinc-400`, `text-rose-600` y `accent-red-600`. Pasarlos a variables (`--gold`, `--silver`, `--bronze`).
- [ ] **Selects y campos inconsistentes.** Rankings usa `bg-background h-11 rounded-md`; el resto `bg-card h-12 rounded-lg`. Crear `Input`, `Select`, `Label` y `Field` en `components/ui` y usarlos en todas partes.
- [ ] **Usar más `Card`.** Agrupar con tarjetas (fondo, borde sutil, padding) en lugar de bloques con `border-y` y `section-divider`.
- [ ] **Componentes base que faltan.** Añadir `Badge`, `Tabs`, `Dialog`, `Skeleton`, `Toast`, `Progress`, `Tooltip`, `EmptyState` y `Stat`.
- [ ] **Escala tipográfica.** Jerarquía fija (página, sección, tarjeta, dato, etiqueta) con una clase por nivel.
- [ ] **Cifras destacadas.** Fuente mono consistente con `tabular-nums` y tamaños grandes para los KPIs.
- [ ] **Iconografía uniforme.** Fijar `strokeWidth` y tamaños (16/20/24) en vez de `size-4`, `size-5` y `size-6` sin criterio.
- [ ] **Elevación y profundidad.** 2 o 3 niveles (fondo, tarjeta, tarjeta elevada) con bordes de 1 px y degradado muy sutil.
- [ ] **Movimiento coherente.** Duraciones y easing comunes, respetando `prefers-reduced-motion`.

## 2. Navegación y estructura

- [ ] **Móvil: Coach e Historial escondidos.** La barra inferior solo tiene 5 de 7 secciones. Menú "Más" o integrar Historial en Recap como pestaña.
- [ ] **Cabecera duplicada.** Mover `AuthStatus` a un menú de avatar (Perfil, Ajustes, Cerrar sesión).
- [ ] **Cabecera sticky compacta.** Título de página, acción principal y avatar en una barra fija pequeña.
- [ ] **Cronómetro como panel/bottom sheet.** Ya existe la píldora global; liberar un hueco en la barra inferior.
- [ ] **Botón "atrás" coherente.** Coach lo tiene solo en móvil; Historial y Recap tienen cada uno el suyo.
- [ ] **Sidebar de escritorio.** Pie con usuario, versión y estado de sincronización; poder colapsarla a solo iconos.
- [ ] **Aprovechar escritorio.** Dejar `max-w-3xl` y usar dos columnas (Entrenar: formulario + visor 3D; Perfil como dashboard de 2 o 3 columnas).
- [ ] **Páginas 404 y de error.** Añadir `not-found.tsx`, `error.tsx`, `global-error.tsx` y `loading.tsx`.

## 3. Pantalla de Perfil (inicio)

- [ ] **Priorizar lo importante.** KPIs y actividad primero; la frase en una tarjeta más pequeña.
- [ ] **Mover el formulario de la foto** a Ajustes o a un diálogo "Editar perfil".
- [ ] **Tarjeta de cabecera** con saludo, avatar, alias, antigüedad ("Miembro desde…"), racha y objetivo semanal.
- [ ] **KPIs con tendencia.** Flecha y porcentaje frente al periodo anterior, como en Recap.
- [ ] **Gráfica de actividad más informativa.** Tooltip o valor encima, resaltar hoy y altura mínima para días vacíos.
- [ ] **Alertas de entrenamiento** (`training-alerts`) con componente de aviso e icono ámbar, no solo texto rojo.
- [ ] **Accesos rápidos "Asistente" e "Historial"** en una fila de iconos con etiqueta.

## 4. Pantalla Entrenar

- [ ] **Formulario arriba en móvil.** Visor 3D plegable o más pequeño; el formulario de nueva serie antes que conversor y tabla.
- [ ] **Modo gimnasio con una mano.** Barra de acción fija abajo con "Guardar serie" y peso/reps en una tarjeta compacta.
- [ ] **Steppers de peso y repeticiones** (±2,5 kg y ±1 rep).
- [ ] **Chips de selección rápida.** "Repetir anterior", "+2,5 kg", "Misma serie".
- [ ] **Selector de ejercicios con búsqueda** y recientes/favoritos, en lugar de `<select>` nativos (51 ejercicios).
- [ ] **Series como lista de tarjetas** con swipe para borrar, en lugar de tabla.
- [ ] **Distintivo de récord (PR)** visible al guardar una serie, con animación breve.
- [ ] **Cabecera de sesión.** Duración, series totales y volumen en vivo, y botón "Finalizar" visible.
- [ ] **Cardio.** Resumen de la sesión en curso en una tarjeta para acortar el contenido.

## 5. Recap, Historial y Rankings

- [ ] **Gráficas reales en Recap.** Gráfico de columnas (Recharts) con tooltip en lugar de 30 filas de barras horizontales.
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

- [ ] **Sustituir `window.confirm`** por diálogos propios (eliminar serie, finalizar, descartar cronómetros, borrar cardio).
- [ ] **Toasts** para "Serie guardada", "Foto actualizada", etc.
- [ ] **Skeletons** en lugar de "Cargando..." con spinner.
- [ ] **Estados vacíos** con ilustración y botón de acción ("Registra tu primer entreno").
- [ ] **Errores con acción** ("Reintentar") de forma uniforme en todas las pantallas.
- [ ] **Pull-to-refresh** o actualización automática en lugar de botones "Actualizar".
- [ ] **Actualizaciones optimistas** al guardar o borrar series, con rollback si falla.

## 9. Accesibilidad y móvil

- [ ] **Quitar `maximumScale: 1`** (bloquea el zoom, fallo WCAG). Mantener `font-size: 16px` en inputs para evitar el zoom de iOS.
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
