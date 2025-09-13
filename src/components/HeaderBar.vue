<script setup>
import { useKanban } from '/src/composables/kanban.js'
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { ui, exportToFile, openImportDialog } = useKanban()

const { needRefresh, updateServiceWorker } = useRegisterSW()

function closeUpdateBanner() {
  try {
    needRefresh.value = false
  } catch (e) {
    // noop
  }
}
</script>

<template>
  <div>
    <div v-if="needRefresh" class="mb-3 p-2 rounded border border-amber-600/40 bg-amber-900/40 text-amber-200 flex items-center justify-between gap-3">
      <div class="text-sm">Hay una actualización disponible.</div>
      <div class="flex gap-2">
        <button @click="updateServiceWorker(true)" class="px-3 py-1 rounded border border-amber-600 text-amber-100 hover:bg-amber-800">Actualizar</button>
        <button @click="closeUpdateBanner" class="px-3 py-1 rounded border border-slate-700 text-slate-200 hover:bg-slate-800">Ignorar</button>
      </div>
    </div>
    <h1 class="text-3xl font-bold">Pizarra Kanban</h1>
    <p class="text-sm text-slate-400">Prioridades: Alta (12h), Media (24h), Normal (48h), Baja (sin límite)</p>
    <div class="mt-3">
      <div class="flex gap-2 items-center">
        <button data-testid="analytics-open" @click="ui.analyticsOpen = true" class="px-3 py-2 rounded border border-slate-700 text-slate-200 hover:bg-slate-800">Abrir Analytics</button>
        <button data-testid="export-btn" @click="exportToFile" class="px-3 py-2 rounded border border-slate-700 text-slate-200 hover:bg-slate-800">Exportar</button>
        <button data-testid="import-open" @click="openImportDialog" class="px-3 py-2 rounded border border-slate-700 text-slate-200 hover:bg-slate-800">Importar</button>
      </div>
    </div>
  </div>
  
</template>

<style scoped>
</style>


