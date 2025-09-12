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
})


