<script setup>
import { useKanban } from '/src/composables/kanban.js'

const { ui, closeDeleteConfirm, confirmDelete } = useKanban()
</script>

<template>
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
</template>

<style scoped>
</style>


