<script setup>
import { useKanban } from '/src/composables/kanban.js'

const { ui, kpis, throughputSeries, leadTimePoints, leadChartWidth, formatDurationMs, agingWip, badgeClass, priorityLabel, timeLeft } = useKanban()
</script>

<template>
  <div v-if="ui.analyticsOpen" class="fixed inset-0 bg-black/40 flex items-center justify-center">
    <div data-testid="analytics-modal" class="bg-slate-950 rounded-lg w-[960px] max-w-[95vw] max-h-[90vh] overflow-auto border border-slate-700 shadow-xl">
      <div class="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-950/90 backdrop-blur">
        <h3 class="font-semibold text-lg">Analytics</h3>
        <button @click="ui.analyticsOpen = false" class="text-slate-400 hover:text-slate-200">✕</button>
      </div>
      <div class="p-4 space-y-6">
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
</template>

<style scoped>
</style>


