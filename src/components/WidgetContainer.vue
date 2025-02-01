<script setup lang="ts">
</script>

<template>
  <div class="widget-container">
    <slot />
  </div>
</template>

<style scoped>
.widget-container {
  --blur: 16px;
  
  border: 1px solid hsla(from var(--white) h s l / .015);
  background: hsla(from var(--black) h s l / .02);
  border-radius: var(--spacing);
  max-width: 400px;
  padding: var(--spacing);
  backdrop-filter: blur(var(--blur)) hue-rotate(0deg);
  box-shadow: 1px 2px 8px hsla(from var(--black) h s l / 0.12);
}
</style>