// Referencias de tipos Node para usar Buffer sin instalar @types/node
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const Buffer: any
import { test, expect } from '@playwright/test'

test.describe('Pizarra Kanban - e2e', () => {
  test.beforeEach(async ({ page }) => {
    // Estado limpio por test
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('crear tarea con prioridad y fecha; contador y persistencia', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('new-title').fill('Primera tarea')
    await page.getByTestId('new-priority').selectOption('alta')

    // Fecha válida: ahora + 1h para estabilidad
    const now = new Date()
    now.setHours(now.getHours() + 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    const val = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    await page.getByTestId('new-due').fill(val)

    await page.getByTestId('add-btn').click()

    // Aparece en TODO y contador
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')
    const todoCards = page.locator('[data-col="todo"] [data-testid="task-card"]')
    await expect(todoCards).toHaveCount(1)
    await expect(todoCards.first()).toContainText('Primera tarea')

    // Persistencia tras volver a navegar a la app
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')
    await expect(page.locator('[data-col="todo"] [data-testid="task-card"]').first()).toContainText('Primera tarea')
  })

  test('editar una tarea actualiza título y prioridad', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('new-title').fill('Para editar')
    await page.getByTestId('add-btn').click()

    const firstCard = page.locator('[data-col="todo"] [data-testid="task-card"]').first()
    await firstCard.getByTestId('edit-btn').click()
    await expect(page.getByTestId('edit-modal')).toBeVisible()
    await page.getByTestId('edit-title').fill('Editada')
    await page.getByTestId('edit-priority').selectOption('media')
    await page.getByTestId('save-edit').click()

    await expect(firstCard).toContainText('Editada')
    await expect(firstCard).toContainText('Media')
  })

  test('editar prioridad recalcula tiempo restante (dueAt) automáticamente', async ({ page }) => {
    await page.goto('/')

    // Crear tarea con prioridad normal (48h por defecto)
    await page.getByTestId('new-title').fill('Con vencimiento')
    await page.getByTestId('new-priority').selectOption('normal')
    await page.getByTestId('add-btn').click()

    const card = page.locator('[data-col="todo"] [data-testid="task-card"]').first()
    // Capturar el texto completo de la línea "Vence: ... (Xh Ym)"
    const dueLine = card.getByText(/^Vence:/)
    const initialText = await dueLine.textContent()

    // Editar y cambiar prioridad a alta sin tocar la fecha
    await card.getByTestId('edit-btn').click()
    await expect(page.getByTestId('edit-modal')).toBeVisible()
    await page.getByTestId('edit-priority').selectOption('alta')
    // No modificar edit-due
    await page.getByTestId('save-edit').click()

    // Verificar que el tiempo restante disminuyó (de ~48h a ~12h)
    await expect(dueLine).toContainText(/\(\-?\d+h \d+m\)/)
    const afterText = await dueLine.textContent()

    // Extraer horas del patrón "(Xh Ym)" o "(-Xh Ym)"
    const extractHours = (s: string | null) => {
      if (!s) return Number.NaN
      const m = s.match(/\((?:-)?(\d+)h\s+\d+m\)/)
      return m ? parseInt(m[1], 10) : Number.NaN
    }
    const hBefore = extractHours(initialText)
    const hAfter = extractHours(afterText)

    expect(Number.isNaN(hBefore)).toBeFalsy()
    expect(Number.isNaN(hAfter)).toBeFalsy()
    // Debe ser significativamente menor: menos de 24h tras pasar de 48h a 12h
    expect(hAfter).toBeLessThan(hBefore)
    expect(hAfter).toBeLessThanOrEqual(12)
  })

  test('borrar una tarea la elimina y actualiza contador', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('new-title').fill('Para borrar')
    await page.getByTestId('add-btn').click()
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')

    const firstCard = page.locator('[data-col="todo"] [data-testid="task-card"]').first()
    await firstCard.getByTestId('delete-btn').click()
    await expect(page.getByTestId('delete-modal')).toBeVisible()
    await page.getByTestId('confirm-delete').click()
    await expect(page.getByTestId('count-todo')).toHaveText(/0 tareas/)
    await expect(page.locator('[data-col="todo"] [data-testid="task-card"]').first()).toHaveCount(0)
  })

  test('cancelar en la modal no borra la tarea', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('new-title').fill('No borrar')
    await page.getByTestId('add-btn').click()
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')

    const firstCard = page.locator('[data-col="todo"] [data-testid="task-card"]').first()
    await firstCard.getByTestId('delete-btn').click()
    await expect(page.getByTestId('delete-modal')).toBeVisible()
    await page.getByTestId('cancel-delete').click()
    await expect(page.getByTestId('delete-modal')).toBeHidden()
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')
    await expect(page.locator('[data-col="todo"] [data-testid="task-card"]').first()).toHaveCount(1)
  })

  test('drag & drop mueve la tarjeta entre columnas', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('new-title').fill('Mover tarea')
    await page.getByTestId('add-btn').click()

    const card = page.locator('[data-col="todo"] [data-testid="task-card"]').first()
    const id = await card.getAttribute('data-id')
    await page.evaluate(({ id }) => {
      if (!id) return
      const source = document.querySelector(`[data-id="${id}"]`)
      const target = document.querySelector('[data-col="inprogress"]')
      if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return
      const dt = new DataTransfer()
      dt.setData('text/plain', JSON.stringify({ id, fromCol: 'todo' }))
      source.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt }))
      target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt }))
    }, { id })

    await expect(page.getByTestId('count-inprogress')).toContainText('1 tareas')
  })

  test('orden por urgencia en TODO e IN PROGRESS (no en DONE)', async ({ page }) => {
    await page.goto('/')

    // Crear 3 tareas con diferentes prioridades (y por ende dueAt por defecto)
    const add = async (t: string, p: 'alta'|'media'|'normal'|'baja') => {
      await page.getByTestId('new-title').fill(t)
      await page.getByTestId('new-priority').selectOption(p)
      await page.getByTestId('add-btn').click()
    }
    await add('T alta', 'alta')
    await add('T normal', 'normal')
    await add('T baja', 'baja')

    const texts = await page.locator('[data-col="todo"] [data-testid="task-card"]').allTextContents()
    // Esperar que la de mayor urgencia (alta) aparezca antes que normal y baja
    expect(texts[0]).toContain('T alta')

    // Mover una a DONE y verificar que DONE no reordena
    const firstCard = page.locator('[data-col="todo"] [data-testid="task-card"]').first()
    const id = await firstCard.getAttribute('data-id')
    await page.evaluate(({ id }) => {
      if (!id) return
      const source = document.querySelector(`[data-id="${id}"]`)
      const target = document.querySelector('[data-col="done"]')
      if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return
      const dt = new DataTransfer()
      dt.setData('text/plain', JSON.stringify({ id, fromCol: 'todo' }))
      source.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt }))
      target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt }))
    }, { id })

    await expect(page.getByTestId('count-done')).toContainText('1 tareas')
  })

  test('exportar descarga un JSON con claves de localStorage', async ({ page }) => {
    await page.goto('/')
    // Crear una tarea para asegurar que exista estado
    await page.getByTestId('new-title').fill('Para exportar')
    await page.getByTestId('add-btn').click()

    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-btn').click(),
    ])

    const suggested = download.suggestedFilename()
    expect(suggested).toMatch(/pizarra-localstorage-.*\.json$/)
  })

  test('importar: cancelar no cambia el estado', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('new-title').fill('No tocar')
    await page.getByTestId('add-btn').click()
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')

    await page.getByTestId('import-open').click()
    await expect(page.getByTestId('import-modal')).toBeVisible()
    await page.getByTestId('import-cancel').click()
    await expect(page.getByTestId('import-modal')).toBeHidden()

    // Estado debe seguir en 1 tarea
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')
  })

  test('importar: JSON inválido muestra error y no cierra modal', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('import-open').click()
    await expect(page.getByTestId('import-modal')).toBeVisible()
    await page.getByTestId('import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalido') })
    // Esperar a que el archivo se procese (FileReader onload) y el botón se habilite
    await expect(page.getByTestId('import-confirm')).toBeEnabled()
    await page.getByTestId('import-confirm').click()
    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByTestId('import-modal')).toBeVisible()
  })

  test('importar: reemplaza por completo el localStorage', async ({ page }) => {
    await page.goto('/')
    // Crear dos tareas para luego sobrescribir
    await page.getByTestId('new-title').fill('A')
    await page.getByTestId('add-btn').click()
    await page.getByTestId('new-title').fill('B')
    await page.getByTestId('add-btn').click()
    await expect(page.getByTestId('count-todo')).toContainText('2 tareas')

    // Preparar un snapshot mínimo que deje 1 tarea en TODO
    const snapshot = await page.evaluate(() => {
      const minimal = { version: 2, tasks: { todo: [{ id: 't_1', title: 'Importada', priority: 'normal', createdAt: new Date().toISOString() }], inprogress: [], done: [] }, events: [] }
      return JSON.stringify({ localStorage: { kanban_state_v2: JSON.stringify(minimal) } })
    })

    await page.getByTestId('import-open').click()
    await page.getByTestId('import-file').setInputFiles({ name: 'snapshot.json', mimeType: 'application/json', buffer: Buffer.from(snapshot) })
    await page.getByTestId('import-confirm').click()

    // Debe haberse reemplazado el estado y quedar 1 tarea Importada
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')
    const text = await page.locator('[data-col="todo"] [data-testid="task-card"]').first().textContent()
    expect(text || '').toContain('Importada')
  })

  test('importar desde archivo habilita confirmación y realiza importación', async ({ page }) => {
    await page.goto('/')

    // Crear archivo temporal con snapshot válido
    const content = await page.evaluate(() => {
      const snap = { version: 2, tasks: { todo: [{ id: 't_x', title: 'Desde archivo', priority: 'normal', createdAt: new Date().toISOString() }], inprogress: [], done: [] }, events: [] }
      return JSON.stringify({ localStorage: { kanban_state_v2: JSON.stringify(snap) } }, null, 2)
    })

    // Playwright no expone API directa para escribir archivo local desde el test runner aquí,
    // pero sí permite setInputFiles con un FilePayload
    await page.getByTestId('import-open').click()
    await expect(page.getByTestId('import-confirm')).toBeDisabled()
    const input = page.getByTestId('import-file')
    await input.setInputFiles({ name: 'import-snapshot.json', mimeType: 'application/json', buffer: Buffer.from(content) })
    await expect(page.getByTestId('import-filename')).toContainText('import-snapshot.json')
    await expect(page.getByTestId('import-confirm')).toBeEnabled()

    // Confirmar importación
    await page.getByTestId('import-confirm').click()
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')
    const txt = await page.locator('[data-col="todo"] [data-testid="task-card"]').first().textContent()
    expect(txt || '').toContain('Desde archivo')
  })

  test('importar: error si falta clave kanban_state_v2', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('new-title').fill('Persistente')
    await page.getByTestId('add-btn').click()
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')

    const content = JSON.stringify({ localStorage: { otra_clave: 'valor' } })
    await page.getByTestId('import-open').click()
    await page.getByTestId('import-file').setInputFiles({ name: 'snapshot-sin-clave.json', mimeType: 'application/json', buffer: Buffer.from(content) })
    await page.getByTestId('import-confirm').click()

    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByTestId('import-error')).toContainText('Falta la clave')
    await expect(page.getByTestId('import-modal')).toBeVisible()
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')
  })

  test('importar: error si kanban_state_v2 no es JSON válido', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('new-title').fill('Persistente')
    await page.getByTestId('add-btn').click()

    const bad = JSON.stringify({ localStorage: { kanban_state_v2: 'no-json' } })
    await page.getByTestId('import-open').click()
    await page.getByTestId('import-file').setInputFiles({ name: 'snapshot-bad-json.json', mimeType: 'application/json', buffer: Buffer.from(bad) })
    await page.getByTestId('import-confirm').click()

    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByTestId('import-error')).toContainText('no contiene JSON válido')
    await expect(page.getByTestId('import-modal')).toBeVisible()
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')
  })

  test('importar: error si tasks.todo no es un arreglo', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('new-title').fill('Persistente')
    await page.getByTestId('add-btn').click()

    const invalid = {
      version: 2,
      tasks: { todo: {}, inprogress: [], done: [] },
      events: [],
    }
    const payload = JSON.stringify({ localStorage: { kanban_state_v2: JSON.stringify(invalid) } })
    await page.getByTestId('import-open').click()
    await page.getByTestId('import-file').setInputFiles({ name: 'snapshot-todo-no-array.json', mimeType: 'application/json', buffer: Buffer.from(payload) })
    await page.getByTestId('import-confirm').click()

    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByTestId('import-error')).toContainText('tasks.todo')
    await expect(page.getByTestId('import-modal')).toBeVisible()
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')
  })

  test('importar: error si prioridad es inválida', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('new-title').fill('Persistente')
    await page.getByTestId('add-btn').click()

    const invalid = {
      version: 2,
      tasks: { todo: [{ id: 't_bad', title: 'X', priority: 'urgente' }], inprogress: [], done: [] },
      events: [],
    }
    const payload = JSON.stringify({ localStorage: { kanban_state_v2: JSON.stringify(invalid) } })
    await page.getByTestId('import-open').click()
    await page.getByTestId('import-file').setInputFiles({ name: 'snapshot-priority.json', mimeType: 'application/json', buffer: Buffer.from(payload) })
    await page.getByTestId('import-confirm').click()

    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByTestId('import-error')).toContainText('Prioridad inválida')
    await expect(page.getByTestId('import-modal')).toBeVisible()
    await expect(page.getByTestId('count-todo')).toContainText('1 tareas')
  })
})


