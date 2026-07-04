<template>
  <div class="client-wait main-content">
    <ActiveWaitScreen :client-id="clientId" />
  </div>
</template>

<script setup lang="ts">
import ActiveWaitScreen from '../components/ActiveWaitScreen.vue';

defineProps<{
  clientId: string;
}>();
</script>

<style scoped>
.client-wait {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}
</style>
