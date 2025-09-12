import { reactive, watch, computed } from 'vue'

const PRIORITY_TO_HOURS = {
  alta: 12,
  media: 24,
  normal: 48,
  baja: null,
}

const STORAGE_KEY = 'kanban_state_v2'
let suspendSave = false

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
  if (suspendSave) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, tasks: state.tasks, events: state.events }))
}

load()
watch(() => state.tasks, save, { deep: true })
watch(() => state.events, save, { deep: true })

// ===== Exportar / Importar =====
function snapshotAllLocalStorage() {
  const obj = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key != null) {
      obj[key] = localStorage.getItem(key)
    }
  }
  return obj
}

function exportAllLocalStorage() {
  const content = {
    __meta__: {
      app: 'pizarra-kanban',
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
    },
    localStorage: snapshotAllLocalStorage(),
  }
  return JSON.stringify(content, null, 2)
}

function exportToFile() {
  try {
    const json = exportAllLocalStorage()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:]/g, '-')
    a.href = url
    a.download = `pizarra-localstorage-${ts}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Error exportando localStorage', e)
  }
}

function parseLocalStorageSnapshot(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('JSON inválido')
  }
  let map = null
  if (parsed && typeof parsed === 'object' && parsed.localStorage && typeof parsed.localStorage === 'object') {
    map = parsed.localStorage
  } else if (parsed && typeof parsed === 'object') {
    map = parsed
  }
  if (!map || typeof map !== 'object') {
    throw new Error('Estructura no reconocida. Esperado objeto con "localStorage" o mapa clave→valor')
  }
  // Asegurar que todos los valores sean strings
  const result = {}
  for (const k of Object.keys(map)) {
    const v = map[k]
    if (typeof v === 'string' || v == null) {
      result[k] = v == null ? '' : v
    } else {
      result[k] = JSON.stringify(v)
    }
  }
  return result
}

function doImportReplaceAll(items) {
  suspendSave = true
  try {
    localStorage.clear()
    for (const [k, v] of Object.entries(items)) {
      try {
        localStorage.setItem(k, v)
      } catch (e) {
        console.warn('No se pudo escribir clave en localStorage', k, e)
      }
    }
    // Re-sincronizar estado de la app desde el snapshot recién importado
    state.tasks.todo = []
    state.tasks.inprogress = []
    state.tasks.done = []
    state.events = []
    load()
  } finally {
    suspendSave = false
  }
}

function openImportDialog() {
  ui.importDialog.open = true
  ui.importDialog.text = ''
  ui.importDialog.error = ''
  ui.importDialog.confirmPhase = false
  ui.importDialog.filename = ''
}

function closeImportDialog() {
  ui.importDialog.open = false
  ui.importDialog.text = ''
  ui.importDialog.error = ''
  ui.importDialog.confirmPhase = false
  ui.importDialog.filename = ''
}

function confirmImport() {
  try {
    const items = parseLocalStorageSnapshot(ui.importDialog.text)
    doImportReplaceAll(items)
    closeImportDialog()
  } catch (e) {
    ui.importDialog.error = e && e.message ? e.message : 'Error importando datos'
  }
}

const ui = reactive({
  newTask: { title: '', priority: 'normal', dueAtInput: '' },
  dragging: { taskId: null, fromCol: null },
  editing: false,
  form: { id: null, title: '', priority: 'normal', dueAtInput: '' },
  editCol: null,
  confirmDelete: { open: false, taskId: null, colId: null, title: '' },
  analyticsOpen: false,
  importDialog: { open: false, text: '', error: '', confirmPhase: false, filename: '' },
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

export function useKanban() {
  return {
    state,
    ui,
    columns,
    priorityLabel,
    badgeClass,
    orderedTasks,
    createTask,
    editTask,
    cancelEdit,
    saveEdit,
    openDeleteConfirm,
    closeDeleteConfirm,
    confirmDelete,
    onDragStart,
    onDrop,
    formatDate,
    timeLeft,
    formatDurationMs,
    kpis,
    throughputSeries,
    leadTimePoints,
    leadChartWidth,
    agingWip,
    // export/import helpers
    exportAllLocalStorage,
    exportToFile,
    openImportDialog,
    closeImportDialog,
    confirmImport,
  }
}


