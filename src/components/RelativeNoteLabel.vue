<template>
  <div class="relative-note-label">
    <div v-if="dotsAbove > 0" class="octave-dots octave-dots-top">
      <span v-for="n in dotsAbove" :key="`top-${n}`" class="octave-dot"></span>
    </div>
    <div class="syllable">{{ syllable }}</div>
    <div v-if="dotsBelow > 0" class="octave-dots octave-dots-bottom">
      <span v-for="n in dotsBelow" :key="`bottom-${n}`" class="octave-dot"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  syllable: string
  dotsAbove: number
  dotsBelow: number
}>()
</script>

<style scoped>
.relative-note-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1;
  gap: 1px;
}

.octave-dots {
  display: flex;
  gap: 1.5px;
  height: 4px;
}

.octave-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background-color: currentColor;
}

.syllable {
  font-size: 0.6rem;
  font-weight: 700;
}
</style>
