import { ref, computed, type Ref } from 'vue'
import { defineStore } from 'pinia'

export type Widget = {
  title: string
  type: 'weather' | 'clock'
}

export const useWidgetStore = defineStore('widgets', () => {
  const widgets: Ref<Map<string, Widget>> = ref(new Map)

  function addWidget(widget: Widget) {
    widgets.value.set(crypto.randomUUID(), widget)
  }
  
  const getWidgets = computed(() => widgets.value)
  return { 
    // State
    widgets,
    // Actions
    addWidget,
    // Getters
    getWidgets
  }
})
