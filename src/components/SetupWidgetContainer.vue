<script setup lang="ts">
</script>

<template>
  <div class="setup-widget-container">
    <slot />
  </div>
</template>

<style scoped>
.setup-widget-container {
  --blur: 16px;

  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  /* border: 1px solid hsla(from var(--white) h s l / .015); */
  /* background: hsla(from var(--black) h s l / .02); */
  border-radius: var(--spacing);
  width: 90%;
  max-width: 400px;
  padding: var(--spacing);
  backdrop-filter: blur(var(--blur)) brightness(1.025);
  box-shadow: 1px 2px 8px hsla(from var(--black) h s l / 0.12);
}
</style>