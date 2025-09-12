<script setup>
import { reactive, watch, computed } from 'vue'

const PRIORITY_TO_HOURS = {
  alta: 12,
  media: 24,
  normal: 48,
  baja: null,
}

const STORAGE_KEY = 'kanban_state_v2'

function uid() {
  return 't_' + Math.random().toString(36).slice(2, 10)
}

function eid() {
  return 'e_' + Math.random().toString(36).slice(2, 10)
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

function formatDurationMs(ms) {
  const abs = Math.abs(ms)
  const d = Math.floor(abs / 86400000)
  const h = Math.floor((abs % 86400000) / 3600000)
  const m = Math.floor((abs % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function percentile(values, p) {
  const v = [...values].sort((a, b) => a - b)
  if (v.length === 0) return 0
  const idx = (v.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return v[lo]
  const w = idx - lo
  return v[lo] * (1 - w) + v[hi] * w
}

function median(values) {
  return percentile(values, 0.5)
}

const state = reactive({
  tasks: {
    todo: [],
    inprogress: [],
    done: [],
  },
  events: [],
})

function logEvent(type, payload) {
  state.events.push({ id: eid(), type, timestamp: new Date().toISOString(), payload })
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    state.tasks.todo = parsed?.tasks?.todo ?? []
    state.tasks.inprogress = parsed?.tasks?.inprogress ?? []
    state.tasks.done = parsed?.tasks?.done ?? []
    state.events = parsed?.events ?? []
  } catch (e) {
    console.error('Error cargando localStorage', e)
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, tasks: state.tasks, events: state.events }))
}

load()
watch(() => state.tasks, save, { deep: true })
watch(() => state.events, save, { deep: true })

const ui = reactive({
  newTask: { title: '', priority: 'normal', dueAtInput: '' },
  dragging: { taskId: null, fromCol: null },
  editing: false,
  form: { id: null, title: '', priority: 'normal', dueAtInput: '' },
  editCol: null,
  confirmDelete: { open: false, taskId: null, colId: null, title: '' },
  analyticsOpen: false,
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
  const now = new Date().toISOString()
  const task = {
    id: uid(),
    title,
    priority,
    dueAt,
    createdAt: now,
    lastUpdatedAt: now,
    editsCount: 0,
    stateTransitions: [{ column: 'todo', enteredAt: now }],
  }
  state.tasks.todo.push(task)
  logEvent('created', { id: task.id, priority: task.priority, dueAt: task.dueAt })
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

  const beforeDue = task.dueAt
  if (didPriorityChange && isDueUnchanged) {
    task.dueAt = defaultDueAt(newPriority)
  } else {
    task.dueAt = parsedNewDue || null
  }
  task.lastUpdatedAt = new Date().toISOString()
  task.editsCount = (task.editsCount || 0) + 1
  logEvent('edited', { id: task.id })
  if (didPriorityChange) {
    logEvent('priority_changed', { id: task.id, before: originalPriority, after: newPriority })
  }
  if ((beforeDue || task.dueAt) && beforeDue !== task.dueAt) {
    logEvent('due_changed', { id: task.id, before: beforeDue, after: task.dueAt })
  }

  cancelEdit()
}

function deleteTask(taskId, colId) {
  const list = state.tasks[colId]
  const idx = list.findIndex((t) => t.id === taskId)
  if (idx !== -1) {
    const removed = list[idx]
    list.splice(idx, 1)
    logEvent('deleted', { id: removed.id, from: colId })
  }
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
  const now = new Date().toISOString()
  moved.stateTransitions = Array.isArray(moved.stateTransitions) ? moved.stateTransitions : []
  moved.stateTransitions.push({ column: toCol, enteredAt: now })
  moved.lastUpdatedAt = now
  logEvent('moved', { id: moved.id, from: fromCol, to: toCol })
  if (toCol === 'done' && !moved.completedAt) {
    moved.completedAt = now
    logEvent('completed', { id: moved.id })
  }
}

function allTasks() {
  return [...state.tasks.todo, ...state.tasks.inprogress, ...state.tasks.done]
}

function tasksNotDone() {
  return [...state.tasks.todo, ...state.tasks.inprogress]
}

function timeEnteredColumn(task, columnId) {
  const arr = Array.isArray(task.stateTransitions) ? task.stateTransitions : []
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].column === columnId) return arr[i].enteredAt
  }
  return task.createdAt || null
}

const kpis = computed(() => {
  const doneTasks = state.tasks.done.filter(t => t.createdAt && t.completedAt)
  const leadTimesMs = doneTasks.map(t => new Date(t.completedAt) - new Date(t.createdAt)).filter(n => Number.isFinite(n) && n >= 0)
  const leadMed = median(leadTimesMs)
  const leadP95 = percentile(leadTimesMs, 0.95)

  const now = new Date()
  const since7d = new Date(now.getTime() - 7 * 86400000)
  const throughput7d = doneTasks.filter(t => new Date(t.completedAt) >= since7d).length

  const slaTasks = doneTasks.filter(t => t.dueAt)
  const slaHit = slaTasks.filter(t => new Date(t.completedAt) <= new Date(t.dueAt)).length
  const slaPct = slaTasks.length ? Math.round((slaHit / slaTasks.length) * 100) : 0

  const wip = {
    todo: state.tasks.todo.length,
    inprogress: state.tasks.inprogress.length,
    done: state.tasks.done.length,
    totalWip: state.tasks.todo.length + state.tasks.inprogress.length,
  }

  return {
    throughput7d,
    leadMedianMs: leadMed || 0,
    leadP95Ms: leadP95 || 0,
    slaPct,
    wip,
  }
})

const throughputSeries = computed(() => {
  const days = 14
  const now = new Date()
  const buckets = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    buckets.push({ key, date: d, count: 0 })
  }
  for (const t of state.tasks.done) {
    if (!t.completedAt) continue
    const key = new Date(t.completedAt).toISOString().slice(0, 10)
    const b = buckets.find(b => b.key === key)
    if (b) b.count++
  }
  const max = Math.max(1, ...buckets.map(b => b.count))
  return { buckets, max }
})

const leadTimePoints = computed(() => {
  const pts = state.tasks.done
    .filter(t => t.createdAt && t.completedAt)
    .slice(-50)
    .map(t => ({
      id: t.id,
      ms: new Date(t.completedAt) - new Date(t.createdAt),
      priority: t.priority,
    }))
  const max = Math.max(1, ...pts.map(p => p.ms))
  return { pts, max }
})

const leadChartWidth = computed(() => {
  return Math.max(leadTimePoints.value.pts.length * 16, 300)
})

const agingWip = computed(() => {
  const list = state.tasks.inprogress.map(t => {
    const enteredAt = timeEnteredColumn(t, 'inprogress')
    const ms = enteredAt ? (Date.now() - new Date(enteredAt).getTime()) : 0
    return {
      id: t.id,
      title: t.title,
      priority: t.priority,
      timeInColumnMs: ms,
      dueAt: t.dueAt,
    }
  })
  return list.sort((a, b) => b.timeInColumnMs - a.timeInColumnMs).slice(0, 10)
})
</script>

<template>
  <div class="p-6 bg-slate-950 text-slate-100 min-h-screen">
    <header class="mb-6">
      <h1 class="text-3xl font-bold">Pizarra Kanban</h1>
      <p class="text-sm text-slate-400">Prioridades: Alta (12h), Media (24h), Normal (48h), Baja (sin límite)</p>
      <div class="mt-3">
        <button data-testid="analytics-open" @click="ui.analyticsOpen = true" class="px-3 py-2 rounded border border-slate-700 text-slate-200 hover:bg-slate-800">Abrir Analytics</button>
      </div>
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

    <!-- Modal Analytics -->
    <div v-if="ui.analyticsOpen" class="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div data-testid="analytics-modal" class="bg-slate-950 rounded-lg w-[960px] max-w-[95vw] max-h-[90vh] overflow-auto border border-slate-700 shadow-xl">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-950/90 backdrop-blur">
          <h3 class="font-semibold text-lg">Analytics</h3>
          <button @click="ui.analyticsOpen = false" class="text-slate-400 hover:text-slate-200">✕</button>
        </div>
        <div class="p-4 space-y-6">
          <!-- KPIs -->
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-slate-900 border border-slate-800 rounded p-3">
              <div class="text-xs text-slate-400 flex items-center">Throughput 7d
                <span class="relative group cursor-help ml-1">ℹ️
                  <div class="absolute z-10 hidden group-hover:block w-64 -left-2 bottom-6 bg-slate-800 text-slate-100 text-xs p-2 rounded border border-slate-700 shadow">
                    Tareas completadas en los últimos 7 días. Ayuda a ver el ritmo.
                  </div>
                </span>
              </div>
              <div class="text-2xl font-semibold" :data-testid="'analytics-throughput-7d'">{{ kpis.throughput7d }}</div>
            </div>
            <div class="bg-slate-900 border border-slate-800 rounded p-3">
              <div class="text-xs text-slate-400 flex items-center">WIP (en curso)
                <span class="relative group cursor-help ml-1">ℹ️
                  <div class="absolute z-10 hidden group-hover:block w-64 -left-2 bottom-6 bg-slate-800 text-slate-100 text-xs p-2 rounded border border-slate-700 shadow">
                    Trabajo en progreso: tareas en TODO + IN PROGRESS. Limitar WIP reduce tiempos.
                  </div>
                </span>
              </div>
              <div class="text-2xl font-semibold" data-testid="analytics-wip">{{ kpis.wip.totalWip }}</div>
              <div class="text-xs text-slate-400">TODO {{ kpis.wip.todo }} · IN PROGRESS {{ kpis.wip.inprogress }}</div>
            </div>
            <div class="bg-slate-900 border border-slate-800 rounded p-3">
              <div class="text-xs text-slate-400 flex items-center">Lead time (mediana)
                <span class="relative group cursor-help ml-1">ℹ️
                  <div class="absolute z-10 hidden group-hover:block w-64 -left-2 bottom-6 bg-slate-800 text-slate-100 text-xs p-2 rounded border border-slate-700 shadow">
                    Tiempo desde creación hasta DONE (mediana). Mide velocidad de entrega.
                  </div>
                </span>
              </div>
              <div class="text-2xl font-semibold" data-testid="analytics-lead-median">{{ formatDurationMs(kpis.leadMedianMs) }}</div>
              <div class="text-xs text-slate-400">p95: {{ formatDurationMs(kpis.leadP95Ms) }}</div>
            </div>
            <div class="bg-slate-900 border border-slate-800 rounded p-3">
              <div class="text-xs text-slate-400 flex items-center">SLA a tiempo
                <span class="relative group cursor-help ml-1">ℹ️
                  <div class="absolute z-10 hidden group-hover:block w-64 -left-2 bottom-6 bg-slate-800 text-slate-100 text-xs p-2 rounded border border-slate-700 shadow">
                    Porcentaje de tareas DONE antes de su fecha límite.
                  </div>
                </span>
              </div>
              <div class="text-2xl font-semibold" data-testid="analytics-sla">{{ kpis.slaPct }}%</div>
            </div>
          </div>

          <!-- Run chart: throughput diario 14d -->
          <div class="bg-slate-900 border border-slate-800 rounded p-3">
            <div class="text-sm font-medium mb-2 flex items-center">Throughput diario (14d)
              <span class="relative group cursor-help ml-2 text-xs text-slate-400">ℹ️
                <div class="absolute z-10 hidden group-hover:block w-72 -left-2 bottom-6 bg-slate-800 text-slate-100 text-xs p-2 rounded border border-slate-700 shadow">
                  Conteo de tareas completadas por día. Útil para ver tendencias y variabilidad.
                </div>
              </span>
            </div>
            <div class="h-28">
              <svg :width="throughputSeries.buckets.length * 22" height="100" class="max-w-full">
                <g v-for="(b, i) in throughputSeries.buckets" :key="b.key">
                  <rect :x="i * 22 + 6" :y="100 - (b.count / throughputSeries.max) * 90 - 5" width="12" :height="(b.count / throughputSeries.max) * 90" class="fill-blue-500/80" />
                  <text :x="i * 22 + 12" y="98" text-anchor="middle" class="fill-slate-400" font-size="8">{{ new Date(b.date).getDate() }}</text>
                </g>
              </svg>
            </div>
          </div>

          <!-- Control chart: lead time últimos 50 -->
          <div class="bg-slate-900 border border-slate-800 rounded p-3">
            <div class="text-sm font-medium mb-2 flex items-center">Control chart de lead time (últimas 50)
              <span class="relative group cursor-help ml-2 text-xs text-slate-400">ℹ️
                <div class="absolute z-10 hidden group-hover:block w-80 -left-2 bottom-6 bg-slate-800 text-slate-100 text-xs p-2 rounded border border-slate-700 shadow">
                  Cada punto es una tarea con su lead time. Observa outliers y estabilidad.
                </div>
              </span>
            </div>
            <div class="h-40 overflow-x-auto">
              <svg :width="leadChartWidth" height="140" class="max-w-full">
                <g v-for="(p, i) in leadTimePoints.pts" :key="p.id">
                  <circle :cx="i * 16 + 12" :cy="130 - (p.ms / leadTimePoints.max) * 120" r="4" :class="p.priority === 'alta' ? 'fill-red-400' : p.priority === 'media' ? 'fill-orange-400' : p.priority === 'normal' ? 'fill-blue-400' : 'fill-slate-400'">
                    <title>{{ 'Lead: ' + formatDurationMs(p.ms) }}</title>
                  </circle>
                </g>
                <text :x="leadChartWidth - 4" y="12" text-anchor="end" font-size="10" class="fill-slate-400">max {{ formatDurationMs(leadTimePoints.max) }}</text>
              </svg>
            </div>
          </div>

          <!-- Tabla: Aging WIP -->
          <div class="bg-slate-900 border border-slate-800 rounded p-3">
            <div class="text-sm font-medium mb-2 flex items-center">Aging WIP (IN PROGRESS)
              <span class="relative group cursor-help ml-2 text-xs text-slate-400">ℹ️
                <div class="absolute z-10 hidden group-hover:block w-80 -left-2 bottom-6 bg-slate-800 text-slate-100 text-xs p-2 rounded border border-slate-700 shadow">
                  Tareas que llevan más tiempo en IN PROGRESS. Priorizan intervención.
                </div>
              </span>
            </div>
            <div class="overflow-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-slate-400">
                    <th class="py-1 pr-2">Título</th>
                    <th class="py-1 pr-2">Prioridad</th>
                    <th class="py-1 pr-2">Tiempo en estado</th>
                    <th class="py-1 pr-2">Tiempo restante</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in agingWip" :key="row.id" class="border-t border-slate-800 hover:bg-slate-800/60">
                    <td class="py-1 pr-2">{{ row.title }}</td>
                    <td class="py-1 pr-2">
                      <span :class="badgeClass({ priority: row.priority })" class="text-xs px-2 py-0.5 rounded-full">{{ priorityLabel(row.priority) }}</span>
                    </td>
                    <td class="py-1 pr-2">{{ formatDurationMs(row.timeInColumnMs) }}</td>
                    <td class="py-1 pr-2">{{ row.dueAt ? timeLeft({ dueAt: row.dueAt, priority: row.priority }) : 'sin límite' }}</td>
                  </tr>
                  <tr v-if="agingWip.length === 0">
                    <td colspan="4" class="py-2 text-slate-400 text-center">Sin tareas en progreso</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

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
