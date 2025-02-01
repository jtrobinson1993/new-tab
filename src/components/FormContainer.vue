<script setup lang="ts">
const { 
  legend,
} = defineProps<{ 
  legend?: string 
}>()
</script>

<template>
  <form class="form-container">
    <fieldset>
      <legend v-if="legend">{{ legend }}</legend>
      <slot />
    </fieldset>
  </form>
</template>

<style scoped>
.form-container {

}

fieldset {
  border: none;
  padding: 0;
}
</style>