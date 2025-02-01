<script setup lang="ts">
import { ref } from 'vue';
import WidgetContainer from '../WidgetContainer.vue';
import FormContainer from '../FormContainer.vue';
import { useWidgetStore, type Widget } from '@/stores/widgets';

const formCity = ref('');
const formLatitude = ref('');
const formLongitude = ref('');

const geocode: any = ref({})
const weather: any = ref({})

const { addWidget } = useWidgetStore()

async function createWidget(event: FormDataEvent) {
  await getLocation(event)
  await getForecast()
  addWidget(weather.value)
}

async function getLocation(event: FormDataEvent) {
  event.preventDefault();
  if (formCity.value) {
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${formCity.value}&count=1&language=en&format=json`);
      
      if (!response.ok) {
        throw new Error(`Error fetching location: ${response.status}`)
      }

      const json = await response.json();
      geocode.value = json.results[0]
    } catch(error) {
      console.log({error})
    }
  }
}

async function getForecast() {
  console.log()
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geocode.value.latitude}&longitude=${geocode.value.longitude}&hourly=temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=${geocode.value.timezone}&forecast_days=1`);
      
      if (!response.ok) {
        throw new Error(`Error fetching forecast: ${response.status}`)
      }

      const json = await response.json();
      weather.value = json
    } catch(error) {
      console.log({error})
    }
}
</script>

<template>
  <WidgetContainer class="widget-weather">
    <FormContainer legend="Enter a Location" @submit="createWidget">
      <label for="widget-weather-city">City or Postal Code</label>
      <input id="widget-weather-city" type="text" v-model="formCity" :disabled="!!(formLatitude || formLongitude)" />
      <div class="or-separator">OR</div>
      <label for="widget-weather-latitude">Latitude</label>
      <input type="number" v-model="formLatitude" :disabled="!!(formCity)" />
      <label for="widget-weather-longitude">Longitude</label>
      <input type="number" v-model="formLongitude" :disabled="!!(formCity)" />
      <button type="submit">Submit</button>
    </FormContainer>
  </WidgetContainer>
</template>

<style scoped>
.widget-weather {
  color: var(--white);
}
</style>