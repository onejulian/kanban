# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## Pruebas E2E (Playwright)

Se usa `@playwright/test` para validar la app de extremo a extremo.

### Scripts

- `npm run test:e2e`: ejecuta toda la suite en Chromium, Firefox y WebKit.
- `npm run test:e2e:ui`: ejecuta con UI interactiva de Playwright.
- `npm run test:e2e:report`: abre el último reporte HTML.

### Configuración

- Archivo: `playwright.config.ts` (levanta la app con `npm run preview` tras `npm run build`).
- Directorio de pruebas: `tests/` (archivos `*.spec.ts`).

### Instalación local

```bash
npm ci
npx playwright install
```

### Ejecutar

```bash
npm run test:e2e
```

Opciones útiles:

- Ejecutar un solo navegador: `npx playwright test --project=chromium`
- Ver el reporte: `npm run test:e2e:report`
- Activar grabación de video: `PWVIDEO=1 npm run test:e2e` (por defecto desactivado; en WebKit queda desactivado siempre)

### Qué cubren las pruebas

- Creación de tareas con prioridad y fecha límite; conteo por columna; persistencia tras navegación.
- Edición de título y prioridad mediante modal.
- Borrado de tareas y actualización de contadores.
- Drag & drop entre columnas (simulado via `DataTransfer`).
- Orden por urgencia en TODO/IN PROGRESS (DONE no reordena).

### Buenas prácticas de selectores

Se añadieron `data-testid` en elementos clave para selectores estables (`new-title`, `add-btn`, `task-card`, `count-<col>`, etc.).
