<script setup lang="ts">
</script>

<template>
  <div class="app-background"></div>
</template>

<style scoped>
.app-background {
  --blur: 4;

  display: block;
  position: fixed;
  width: 100vw;
  height: 100vh;
  left: 0;
  top: 0;
  background-color: var(--black);
  background-image: url('@/assets/bg.png');
  background-position: center;
  background-size: cover;
  filter: blur(calc(var(--blur) * 1px)) brightness(.8);
  transform: scale(calc((100 + var(--blur) / 2) / 100));
  transition: filter .3s linear, transform .3s linear;
  z-index: -1;
}
</style>