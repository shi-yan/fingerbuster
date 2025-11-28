<template>
  <div class="practice-mode">
    <div class="practice-header card">
      <h2>Practice Mode</h2>
      <div class="practice-controls">
        <button
          v-if="!isStarted"
          @click="startPractice"
          class="btn-primary"
        >
          Start Practice
        </button>
        <button
          v-else
          @click="stopPractice"
          class="btn-danger"
        >
          Stop Practice
        </button>
      </div>
    </div>

    <div v-if="isStarted" class="current-chord-display card">
      <h3>Current Chord: <span class="chord-name">{{ currentChordName }}</span></h3>
      <div class="progress-info">
        <p>Progress: {{ currentChordIndex + 1 }} / {{ practiceChords.length }}</p>
        <p v-if="startTime">Time: {{ currentTime.toFixed(2) }}s</p>
      </div>
    </div>

    <FretBoard
      :fretPositions="fretPositions"
      :selectedChord="isStarted ? currentChordName : null"
    />

    <!-- Statistics Display -->
    <div v-if="statistics.length > 0" class="statistics card">
      <h3>Statistics</h3>
      <div class="stats-grid">
        <div
          v-for="stat in statistics"
          :key="stat.chord"
          class="stat-item"
        >
          <div class="stat-chord">{{ stat.chord }}</div>
          <div class="stat-times">
            <div class="stat-row">
              <span class="stat-label">Average:</span>
              <span class="stat-value">{{ stat.average.toFixed(2) }}s</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Best:</span>
              <span class="stat-value best">{{ stat.best.toFixed(2) }}s</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Attempts:</span>
              <span class="stat-value">{{ stat.attempts }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { sharedMidi } from '../midi'
import FretBoard from './FretBoard.vue'
import chordsData from '../data/chords.json'

const { fretPositions } = sharedMidi

// Practice chords
const practiceChords = ['G', 'C', 'D', 'Em']

// Practice state
const isStarted = ref(false)
const currentChordIndex = ref(0)
const startTime = ref<number | null>(null)
const currentTime = ref(0)
const timer = ref<number | null>(null)

// Statistics
interface ChordStat {
  chord: string
  times: number[]
  average: number
  best: number
  attempts: number
}

const chordTimes = ref<Record<string, number[]>>({})

const currentChordName = computed(() => {
  return practiceChords[currentChordIndex.value] || ''
})

const statistics = computed(() => {
  const stats: ChordStat[] = []
  for (const chord of practiceChords) {
    const times = chordTimes.value[chord] || []
    if (times.length > 0) {
      const average = times.reduce((a, b) => a + b, 0) / times.length
      const best = Math.min(...times)
      stats.push({
        chord,
        times,
        average,
        best,
        attempts: times.length
      })
    }
  }
  return stats
})

// Get chord definition
const getChordDefinition = (chordName: string) => {
  const chordData = chordsData.find(c => c.name === chordName)
  if (!chordData) return null

  const positions = new Map<number, number>()
  for (let string = 1; string <= 6; string++) {
    const stringKey = `string_${string}` as keyof typeof chordData
    const stringData = chordData[stringKey] as { play: boolean; fret: number; finger: number }
    if (stringData.play && stringData.fret > 0) {
      positions.set(string, stringData.fret)
    }
  }
  return positions
}

// Check if user's finger positions match the current chord
const checkChordMatch = (): boolean => {
  if (!currentChordName.value) return false

  const targetChord = getChordDefinition(currentChordName.value)
  if (!targetChord) return false

  // Check if all required positions are pressed
  for (const [string, fret] of targetChord.entries()) {
    if (fretPositions.value.get(string) !== fret) {
      return false
    }
  }

  // Check if no extra strings are pressed
  for (const [string, _fret] of fretPositions.value.entries()) {
    if (!targetChord.has(string)) {
      return false
    }
  }

  return true
}

// Update timer
const updateTimer = () => {
  if (startTime.value) {
    currentTime.value = (Date.now() - startTime.value) / 1000
  }
}

// Start practice
const startPractice = () => {
  isStarted.value = true
  currentChordIndex.value = 0
  startTime.value = Date.now()
  currentTime.value = 0

  // Start timer
  timer.value = window.setInterval(updateTimer, 50)
}

// Stop practice
const stopPractice = () => {
  isStarted.value = false
  startTime.value = null
  currentTime.value = 0

  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
}

// Move to next chord
const nextChord = (time: number) => {
  // Record time for current chord
  const chord = currentChordName.value
  if (!chord) return

  if (!chordTimes.value[chord]) {
    chordTimes.value[chord] = []
  }
  chordTimes.value[chord].push(time)

  // Move to next chord
  currentChordIndex.value++

  if (currentChordIndex.value >= practiceChords.length) {
    // Loop back to start
    currentChordIndex.value = 0
  }

  // Reset timer for next chord
  startTime.value = Date.now()
  currentTime.value = 0
}

// Watch for chord matches
watch(() => fretPositions.value, () => {
  if (isStarted.value && startTime.value && fretPositions.value.size > 0) {
    if (checkChordMatch()) {
      const time = currentTime.value
      nextChord(time)
    }
  }
}, { deep: true })
</script>

<style scoped>
.practice-mode {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.practice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
}

.practice-header h2 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0;
}

.practice-controls {
  display: flex;
  gap: 1rem;
}

.current-chord-display {
  padding: 1.5rem;
  text-align: center;
}

.current-chord-display h3 {
  font-size: 1.25rem;
  color: #4b5563;
  margin-bottom: 1rem;
}

.chord-name {
  font-size: 2rem;
  font-weight: bold;
  color: #4f46e5;
  padding: 0.5rem 1rem;
  background-color: #eef2ff;
  border-radius: 8px;
}

.progress-info {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 1rem;
  font-size: 1rem;
  color: #6b7280;
}

.statistics {
  padding: 1.5rem;
}

.statistics h3 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-item {
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.stat-chord {
  font-size: 1.5rem;
  font-weight: bold;
  color: #4f46e5;
  margin-bottom: 0.75rem;
  text-align: center;
}

.stat-times {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

.stat-value.best {
  color: #10b981;
}
</style>
