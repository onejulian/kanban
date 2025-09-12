<script setup>
import { useKanban } from '/src/composables/kanban.js'

const { state, columns, orderedTasks, badgeClass, priorityLabel, formatDate, timeLeft, editTask, openDeleteConfirm, onDragStart, onDrop, isDescriptionExpanded, toggleDescription } = useKanban()
</script>

<template>
  <div class="grid grid-cols-3 gap-4">
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
          <div v-if="task.description && isDescriptionExpanded(task.id)" class="mt-2 text-sm text-slate-200 whitespace-pre-wrap break-words border-t border-slate-700 pt-2">
            {{ task.description }}
          </div>
          <div v-if="col.id !== 'done'" class="mt-1 text-xs text-slate-400">
            <span v-if="task.dueAt">Vence: {{ formatDate(task.dueAt) }} ({{ timeLeft(task) }})</span>
            <span v-else>Sin fecha límite</span>
          </div>

          <div class="mt-3 flex gap-2">
            <button v-if="col.id !== 'done'" data-testid="edit-btn" @dragstart.stop @click="editTask(task, col.id)" class="text-blue-400 hover:text-blue-300 underline text-sm">Editar</button>
            <button v-if="task.description" @dragstart.stop @click="toggleDescription(task.id)" class="text-slate-300 hover:text-slate-100 underline text-sm">
              {{ isDescriptionExpanded(task.id) ? 'Ocultar descripción' : 'Mostrar descripción' }}
            </button>
            <button data-testid="delete-btn" @dragstart.stop @click="openDeleteConfirm(task, col.id)" class="text-red-400 hover:text-red-300 underline text-sm">Borrar</button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>


