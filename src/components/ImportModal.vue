<script setup>
import { useKanban } from '/src/composables/kanban.js'

const { ui, closeImportDialog, confirmImport } = useKanban()

function onFileChange(e) {
  ui.importDialog.error = ''
  const files = e?.target?.files
  if (!files || !files[0]) return
  const file = files[0]
  ui.importDialog.filename = file.name
  const reader = new FileReader()
  reader.onload = () => {
    try {
      ui.importDialog.text = String(reader.result || '')
    } catch (err) {
      ui.importDialog.error = 'No se pudo leer el archivo'
    }
  }
  reader.onerror = () => {
    ui.importDialog.error = 'No se pudo leer el archivo'
  }
  reader.readAsText(file)
}
</script>

<template>
  <div v-if="ui.importDialog.open" class="fixed inset-0 bg-black/30 flex items-center justify-center">
    <div data-testid="import-modal" class="bg-slate-900 rounded-lg w-[720px] max-w-[95vw] shadow border border-slate-700">
      <div class="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 class="font-semibold">Importar datos</h3>
        <button @click="closeImportDialog" class="text-slate-400 hover:text-slate-200">✕</button>
      </div>
      <div class="p-4 space-y-3">
        <p class="text-sm text-slate-300">Selecciona el archivo JSON exportado. Al confirmar, <span class="font-semibold">se reemplazará por completo</span> el contenido de localStorage.</p>
        <div class="flex items-center gap-3">
          <input id="import-file-input" data-testid="import-file" type="file" accept="application/json,.json" class="hidden" @change="onFileChange" />
          <label for="import-file-input" class="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer select-none">
            Seleccionar archivo
          </label>
          <span data-testid="import-filename" class="text-xs text-slate-400">{{ ui.importDialog.filename || 'Sin archivos seleccionados' }}</span>
        </div>
        <p v-if="ui.importDialog.error" data-testid="import-error" class="text-red-400 text-sm">{{ ui.importDialog.error }}</p>
        <div class="bg-amber-900/30 text-amber-200 text-xs p-2 rounded border border-amber-800">Esta acción es destructiva: sobreescribe todas las claves del localStorage.</div>
      </div>
      <div class="p-4 border-t border-slate-700 flex gap-2 justify-end">
        <button data-testid="import-cancel" @click="closeImportDialog" class="px-4 py-2 rounded border border-slate-700 text-slate-200">Cancelar</button>
        <button data-testid="import-confirm" @click="confirmImport" :disabled="!ui.importDialog.text" class="px-4 py-2 rounded text-white" :class="!ui.importDialog.text ? 'bg-red-600/50 cursor-not-allowed opacity-60' : 'bg-red-600 hover:bg-red-700'">Confirmar importación</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>


