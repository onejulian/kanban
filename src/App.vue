<script setup>
import HeaderBar from './components/HeaderBar.vue'
import TaskForm from './components/TaskForm.vue'
import KanbanBoard from './components/KanbanBoard.vue'
import AnalyticsModal from './components/AnalyticsModal.vue'
import EditModal from './components/EditModal.vue'
import DeleteModal from './components/DeleteModal.vue'
import '/src/composables/kanban.js'
</script>

<template>
  <div class="p-6 bg-slate-950 text-slate-100 min-h-screen">
    <header class="mb-6">
      <HeaderBar />
    </header>

    <section class="mb-4">
      <TaskForm />
    </section>

    <KanbanBoard />

    <AnalyticsModal />
    <EditModal />
    <DeleteModal />
  </div>
</template>

<style scoped>
</style>
