<script setup>
import { useKanban } from '/src/composables/kanban.js'

const { ui } = useKanban()
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold">Pizarra Kanban</h1>
    <p class="text-sm text-slate-400">Prioridades: Alta (12h), Media (24h), Normal (48h), Baja (sin límite)</p>
    <div class="mt-3">
      <button data-testid="analytics-open" @click="ui.analyticsOpen = true" class="px-3 py-2 rounded border border-slate-700 text-slate-200 hover:bg-slate-800">Abrir Analytics</button>
    </div>
  </div>
  
</template>

<style scoped>
</style>


