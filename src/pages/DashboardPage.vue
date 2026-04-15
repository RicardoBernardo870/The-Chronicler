<template>
  <div class="page-container">
    <h1 class="page-title">Your Reading</h1>
    <EmptyState
      icon="pi-book"
      title="No current read"
      description="Add a book to get started."
    >
      <template #action>
        <RouterLink to="/books/add">
          <Button label="Add a book" icon="pi pi-plus" />
        </RouterLink>
      </template>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import EmptyState from '@/components/shared/EmptyState.vue'
</script>
