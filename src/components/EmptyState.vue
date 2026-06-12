<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="empty-state">
    <i v-if="icon" :class="['pi', icon, 'empty-icon']" />
    <h3 class="empty-title">{{ title }}</h3>
    <p v-if="description" class="fs-muted empty-desc">{{ description }}</p>
    <div class="empty-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}
.empty-icon {
  font-size: 2.75rem;
  color: var(--p-primary-color);
  opacity: 0.85;
}
.empty-title {
  margin: 0.25rem 0 0;
  font-size: 1.2rem;
}
.empty-desc {
  max-width: 420px;
  margin: 0;
}
.empty-actions {
  margin-top: 0.75rem;
}
</style>
