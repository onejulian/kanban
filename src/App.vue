<script setup>
import { reactive, watch } from 'vue'

const PRIORITY_TO_HOURS = {
  alta: 12,
  media: 24,
  normal: 48,
  baja: null,
}

const STORAGE_KEY = 'kanban_state_v1'

function uid() {
  return 't_' + Math.random().toString(36).slice(2, 10)
}

function defaultDueAt(priority) {
  const hours = PRIORITY_TO_HOURS[priority]
  if (hours == null) return null
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d.toISOString()
}

function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const MM = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`
}

function fromLocalInputValue(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d) ? null : d.toISOString()
}

function effectiveDueAt(task) {
  if (task.dueAt) return task.dueAt
  return defaultDueAt(task.priority)
}

function urgencyScore(task) {
  const due = effectiveDueAt(task)
  if (!due) return Number.POSITIVE_INFINITY
  return new Date(due).getTime() - Date.now()
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString()
}

function timeLeft(task) {
  const due = effectiveDueAt(task)
  if (!due) return 'sin límite'
  const ms = new Date(due) - new Date()
  const sign = ms < 0 ? '-' : ''
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3600000)
  const m = Math.floor((abs % 3600000) / 60000)
  return `${sign}${h}h ${m}m`
}

const state = reactive({
  tasks: {
    todo: [],
    inprogress: [],
    done: [],
  },
})

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    state.tasks.todo = parsed?.tasks?.todo ?? []
    state.tasks.inprogress = parsed?.tasks?.inprogress ?? []
    state.tasks.done = parsed?.tasks?.done ?? []
  } catch (e) {
    console.error('Error cargando localStorage', e)
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: state.tasks }))
}

load()
watch(() => state.tasks, save, { deep: true })

const ui = reactive({
  newTask: { title: '', priority: 'normal', dueAtInput: '' },
  dragging: { taskId: null, fromCol: null },
  editing: false,
  form: { id: null, title: '', priority: 'normal', dueAtInput: '' },
  editCol: null,
  confirmDelete: { open: false, taskId: null, colId: null, title: '' },
})

const columns = [
  { id: 'todo', title: 'To Do' },
  { id: 'inprogress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

function priorityLabel(p) {
  return p === 'alta' ? 'Alta' : p === 'media' ? 'Media' : p === 'baja' ? 'Baja' : 'Normal'
}

function badgeClass(task) {
  const map = {
    alta: 'bg-red-100 text-red-800 border border-red-200',
    media: 'bg-orange-100 text-orange-800 border border-orange-200',
    normal: 'bg-blue-100 text-blue-800 border border-blue-200',
    baja: 'bg-slate-100 text-slate-700 border border-slate-200',
  }
  return map[task.priority] || map.normal
}

function orderedTasks(colId) {
  const list = state.tasks[colId] || []
  if (colId === 'done') return list
  return [...list].sort((a, b) => urgencyScore(a) - urgencyScore(b))
}

function createTask() {
  const title = ui.newTask.title.trim()
  if (!title) return
  const priority = ui.newTask.priority || 'normal'
  const dueAt = fromLocalInputValue(ui.newTask.dueAtInput) || defaultDueAt(priority)
  state.tasks.todo.push({
    id: uid(),
    title,
    priority,
    dueAt,
    createdAt: new Date().toISOString(),
  })
  ui.newTask.title = ''
  ui.newTask.priority = 'normal'
  ui.newTask.dueAtInput = ''
}

function editTask(task, colId) {
  ui.editing = true
  ui.form.id = task.id
  ui.form.title = task.title
  ui.form.priority = task.priority
  ui.form.dueAtInput = toLocalInputValue(task.dueAt)
  ui.editCol = colId
}

function cancelEdit() {
  ui.editing = false
  ui.form.id = null
  ui.form.title = ''
  ui.form.priority = 'normal'
  ui.form.dueAtInput = ''
  ui.editCol = null
}

function saveEdit() {
  const colId = ui.editCol
  if (!colId) return cancelEdit()
  const list = state.tasks[colId]
  const idx = list.findIndex((t) => t.id === ui.form.id)
  if (idx === -1) return cancelEdit()
  const task = list[idx]

  const originalPriority = task.priority
  const originalDueLocal = toLocalInputValue(task.dueAt)
  const newTitle = ui.form.title.trim()
  const newPriority = ui.form.priority || 'normal'
  const dueInput = ui.form.dueAtInput || ''
  const parsedNewDue = fromLocalInputValue(dueInput)
  const isDueUnchanged = (dueInput || '') === (originalDueLocal || '')
  const didPriorityChange = newPriority !== originalPriority

  task.title = newTitle || task.title
  task.priority = newPriority

  if (didPriorityChange && isDueUnchanged) {
    task.dueAt = defaultDueAt(newPriority)
  } else {
    task.dueAt = parsedNewDue || null
  }

  cancelEdit()
}

function deleteTask(taskId, colId) {
  const list = state.tasks[colId]
  const idx = list.findIndex((t) => t.id === taskId)
  if (idx !== -1) list.splice(idx, 1)
}

function openDeleteConfirm(task, colId) {
  ui.confirmDelete.open = true
  ui.confirmDelete.taskId = task.id
  ui.confirmDelete.colId = colId
  ui.confirmDelete.title = task.title
}

function closeDeleteConfirm() {
  ui.confirmDelete.open = false
  ui.confirmDelete.taskId = null
  ui.confirmDelete.colId = null
  ui.confirmDelete.title = ''
}

function confirmDelete() {
  if (ui.confirmDelete.taskId && ui.confirmDelete.colId) {
    deleteTask(ui.confirmDelete.taskId, ui.confirmDelete.colId)
  }
  closeDeleteConfirm()
}

function onDragStart(e, task, fromCol) {
  ui.dragging.taskId = task.id
  ui.dragging.fromCol = fromCol
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', JSON.stringify({ id: task.id, fromCol }))
}

function onDrop(e, toCol) {
  const data = e.dataTransfer.getData('text/plain')
  if (!data) return
  let payload
  try {
    payload = JSON.parse(data)
  } catch {
    return
  }
  const { id: draggedId, fromCol } = payload
  if (!draggedId || !fromCol) return
  if (!['todo', 'inprogress', 'done'].includes(toCol)) return
  if (fromCol === toCol) return
  const fromList = state.tasks[fromCol]
  const idx = fromList.findIndex((t) => t.id === draggedId)
  if (idx === -1) return
  const [moved] = fromList.splice(idx, 1)
  state.tasks[toCol].push(moved)
}
</script>

<template>
  <div class="p-6 bg-slate-950 text-slate-100 min-h-screen">
    <header class="mb-6">
      <h1 class="text-3xl font-bold">Pizarra Kanban</h1>
      <p class="text-sm text-slate-400">Prioridades: Alta (12h), Media (24h), Normal (48h), Baja (sin límite)</p>
    </header>

    <section class="mb-4">
      <div class="flex gap-2 items-end">
        <div class="flex-1">
          <label class="block text-sm font-medium text-slate-200">Título</label>
          <input data-testid="new-title" v-model="ui.newTask.title" class="w-full border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-400 rounded px-3 py-2" placeholder="Nueva tarea" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-200">Prioridad</label>
          <select data-testid="new-priority" v-model="ui.newTask.priority" class="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2">
            <option value="alta">Alta (12h)</option>
            <option value="media">Media (24h)</option>
            <option value="normal">Normal (48h)</option>
            <option value="baja">Baja (sin límite)</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-200">Fecha límite</label>
          <input data-testid="new-due" v-model="ui.newTask.dueAtInput" type="datetime-local" class="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2" />
        </div>
        <button data-testid="add-btn" @click="createTask" class="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded">Añadir a TODO</button>
      </div>
    </section>

    <main class="grid grid-cols-3 gap-4">
      <div v-for="col in columns" :key="col.id" class="bg-slate-900 rounded-lg shadow border border-slate-700 flex flex-col h-[70vh]">
        <div class="p-3 border-b border-slate-700 flex items-center justify-between">
          <h2 class="font-semibold">{{ col.title }}</h2>
          <span :data-testid="'count-' + col.id" class="text-xs text-slate-400">{{ state.tasks[col.id].length }} tareas</span>
        </div>
        <div
          class="flex-1 p-3 space-y-2 overflow-auto scrollbar-none"
          :data-col="col.id"
          @dragover.prevent
          @drop="onDrop($event, col.id)"
        >
          <article
            v-for="task in orderedTasks(col.id)"
            :key="task.id"
            class="border border-slate-700 rounded p-3 bg-slate-800 hover:bg-slate-700 cursor-move"
            data-testid="task-card"
            :data-id="task.id"
            draggable="true"
            @dragstart="onDragStart($event, task, col.id)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="font-medium break-words">{{ task.title }}</div>
              <span :class="badgeClass(task)" class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap">{{ priorityLabel(task.priority) }}</span>
            </div>
            <div class="mt-1 text-xs text-slate-400">
              <span v-if="task.dueAt">Vence: {{ formatDate(task.dueAt) }} ({{ timeLeft(task) }})</span>
              <span v-else>Sin fecha límite</span>
            </div>

            <div class="mt-3 flex gap-2">
              <button v-if="col.id !== 'done'" data-testid="edit-btn" @dragstart.stop @click="editTask(task, col.id)" class="text-blue-400 hover:text-blue-300 underline text-sm">Editar</button>
              <button data-testid="delete-btn" @dragstart.stop @click="openDeleteConfirm(task, col.id)" class="text-red-400 hover:text-red-300 underline text-sm">Borrar</button>
            </div>
          </article>
        </div>
      </div>
    </main>

    <div v-if="ui.editing" class="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div data-testid="edit-modal" class="bg-slate-900 rounded-lg w-[640px] max-w-[95vw] shadow border border-slate-700">
        <div class="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 class="font-semibold">Editar tarea</h3>
          <button @click="cancelEdit" class="text-slate-400 hover:text-slate-200">✕</button>
        </div>
        <div class="p-4 space-y-3">
          <div>
            <label class="block text-sm font-medium text-slate-200">Título</label>
            <input data-testid="edit-title" v-model="ui.form.title" class="w-full border border-slate-700 bg-slate-950 text-slate-100 placeholder-slate-400 rounded px-3 py-2" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-200">Prioridad</label>
              <select data-testid="edit-priority" v-model="ui.form.priority" class="w-full border border-slate-700 bg-slate-950 text-slate-100 rounded px-3 py-2">
                <option value="alta">Alta (12h)</option>
                <option value="media">Media (24h)</option>
                <option value="normal">Normal (48h)</option>
                <option value="baja">Baja (sin límite)</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-200">Fecha límite</label>
              <input data-testid="edit-due" v-model="ui.form.dueAtInput" type="datetime-local" class="w-full border border-slate-700 bg-slate-950 text-slate-100 rounded px-3 py-2" />
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-slate-700 flex gap-2 justify-end">
          <button data-testid="cancel-edit" @click="cancelEdit" class="px-4 py-2 rounded border border-slate-700 text-slate-200">Cancelar</button>
          <button data-testid="save-edit" @click="saveEdit" class="px-4 py-2 rounded bg-blue-600 text-white">Guardar</button>
        </div>
      </div>
    </div>

    <div v-if="ui.confirmDelete.open" class="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div data-testid="delete-modal" class="bg-slate-900 rounded-lg w-[520px] max-w-[95vw] shadow border border-slate-700">
        <div class="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 class="font-semibold">Confirmar borrado</h3>
          <button @click="closeDeleteConfirm" class="text-slate-400 hover:text-slate-200">✕</button>
        </div>
        <div class="p-4 space-y-2">
          <p>¿Seguro que deseas borrar la tarea <span class="font-semibold">"{{ ui.confirmDelete.title }}"</span>?</p>
          <p class="text-sm text-slate-400">Esta acción no se puede deshacer.</p>
        </div>
        <div class="p-4 border-t border-slate-700 flex gap-2 justify-end">
          <button data-testid="cancel-delete" @click="closeDeleteConfirm" class="px-4 py-2 rounded border border-slate-700 text-slate-200">Cancelar</button>
          <button data-testid="confirm-delete" @click="confirmDelete" class="px-4 py-2 rounded bg-red-600 text-white">Borrar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
