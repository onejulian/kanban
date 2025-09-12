<script setup>
import { ref } from 'vue'

defineProps({
  msg: String,
})

const count = ref(0)
</script>

<template>
  <h1 class="text-2xl font-semibold mb-2">{{ msg }}</h1>
  <div class="card space-y-2">
    <button type="button" @click="count++" class="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">count is {{ count }}</button>
    <p class="text-slate-300">
      Edita <code class="text-slate-200">components/HelloWorld.vue</code> para probar HMR
    </p>
  </div>
  <p class="text-slate-300 mt-2">
    Revisa
    <a href="https://vuejs.org/guide/quick-start.html#local" target="_blank" class="text-blue-400 hover:text-blue-300 underline">create-vue</a>, el starter oficial de Vue + Vite
  </p>
  <p class="text-slate-300">
    Aprende más sobre el soporte del IDE para Vue en la
    <a href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support" target="_blank" class="text-blue-400 hover:text-blue-300 underline">guía de escalado de Vue</a>.
  </p>
  <p class="read-the-docs">Haz clic en los logos de Vite y Vue para saber más</p>
</template>

<style scoped>
.read-the-docs {
  color: #94a3b8;
}
</style>
