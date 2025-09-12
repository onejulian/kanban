<script setup>
import { useKanban } from '/src/composables/kanban.js'

const { ui, createTask } = useKanban()
</script>

<template>
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
    <!-- <div>
      <label class="block text-sm font-medium text-slate-200">Fecha límite</label>
      <input data-testid="new-due" v-model="ui.newTask.dueAtInput" type="datetime-local" class="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2" />
    </div> -->
    <button data-testid="add-btn" @click="createTask" class="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded">Añadir a TODO</button>
  </div>
</template>

<style scoped>
</style>


