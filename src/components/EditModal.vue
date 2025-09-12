<script setup>
import { useKanban } from '/src/composables/kanban.js'

const { ui, cancelEdit, saveEdit } = useKanban()
</script>

<template>
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
</template>

<style scoped>
</style>


