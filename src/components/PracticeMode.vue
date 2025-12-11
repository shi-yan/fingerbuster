<template>
  <div class="practice-mode">
    <div class="practice-header card">
      <h2>Practice Mode</h2>
      <div class="practice-controls">
        <div class="progression-selector">
          <label for="progression">Chord Progression:</label>
          <select
            id="progression"
            v-model="selectedProgression"
            :disabled="isStarted"
            class="progression-dropdown"
          >
            <option
              v-for="(prog, index) in progressions"
              :key="index"
              :value="index"
            >
              {{ prog.name }}
            </option>
          </select>
        </div>
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
      <div class="progression-display">
        <p>Progression: {{ progressions[selectedProgression]?.name || 'Unknown' }}</p>
      </div>
    </div>

    <FretBoard
      :fretPositions="fretPositions"
      :selectedChord="isStarted ? currentChordName : null"
      :stringStatus="isStarted ? stringStatusMap : undefined"
    />

    <!-- Debug Display -->
    <div v-if="isStarted" class="debug-display card">
      <h3>Debug Information</h3>

      <div class="debug-section">
        <h4>Plucked Strings ({{ stringsPlucked.size }})</h4>
        <div v-if="stringsPlucked.size === 0" class="empty-message">
          No strings plucked yet
        </div>
        <div v-else class="debug-list">
          <div
            v-for="string in Array.from(stringsPlucked)"
            :key="`plucked-${string}`"
            class="debug-item"
          >
            <span class="debug-label">String {{ string }}:</span>
            <span class="debug-value">Note {{ pluckedNotes.get(string) }}</span>
          </div>
        </div>
      </div>

      <div class="debug-section">
        <h4>Pluck Order</h4>
        <div v-if="pluckOrder.length === 0" class="empty-message">
          No plucks recorded
        </div>
        <div v-else class="debug-value">
          {{ pluckOrder.join(' → ') }}
        </div>
      </div>

      <div class="debug-section" v-if="currentChordName">
        <h4>Target Chord: {{ currentChordName }}</h4>
        <div class="debug-list">
          <div class="debug-item">
            <span class="debug-label">Required Strings:</span>
            <span class="debug-value">{{ Array.from(getChordDefinition(currentChordName)?.stringsToPlay || []).sort((a, b) => b - a).join(', ') }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Skip Strings:</span>
            <span class="debug-value">{{ Array.from(getChordDefinition(currentChordName)?.stringsNotToPlay || []).sort((a, b) => b - a).join(', ') || 'None' }}</span>
          </div>
        </div>
      </div>
    </div>

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
import { sharedMidi } from '../composables/useMidi'
import FretBoard from './FretBoard.vue'
import chordsData from '../data/chords.json'
import { addChordTransition } from '../db/practiceDb'

const { fretPositions, stringsPlucked, pluckOrder, pluckedNotes, clearStringsPlucked } = sharedMidi

// Chord progressions
interface Progression {
  name: string
  chords: string[]
}

const progressions: Progression[] = [
  {
    name: 'Current Order (G → C → D → Em)',
    chords: ['G', 'C', 'D', 'Em']
  },
  {
    name: 'Pop Anthem (I-V-vi-IV): G → D → Em → C',
    chords: ['G', 'D', 'Em', 'C']
  },
  {
    name: 'Emotional Ballad (vi-IV-I-V): Em → C → G → D',
    chords: ['Em', 'C', 'G', 'D']
  },
  {
    name: '50s Doo-Wop (I-vi-IV-V): G → Em → C → D',
    chords: ['G', 'Em', 'C', 'D']
  },
  {
    name: 'Folk/Country (I-IV-I-V): G → C → G → D',
    chords: ['G', 'C', 'G', 'D']
  }
]

const selectedProgression = ref(0)

const practiceChords = computed(() => {
  return progressions[selectedProgression.value]?.chords || []
})

// Practice state
const isStarted = ref(false)
const currentChordIndex = ref(0)
const startTime = ref<number | null>(null)
const currentTime = ref(0)
const timer = ref<number | null>(null)

// String tracking for validation
const stringsPlayedMap = ref<Map<number, boolean>>(new Map())
const stringPlayCount = ref(0)

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
  return practiceChords.value[currentChordIndex.value] || ''
})

// Calculate string status for visualization
const stringStatusMap = computed(() => {
  if (!isStarted.value || !currentChordName.value) {
    return new Map<number, 'correct' | 'wrong' | 'unplayed'>()
  }

  const targetChord = getChordDefinition(currentChordName.value)
  if (!targetChord) {
    return new Map<number, 'correct' | 'wrong' | 'unplayed'>()
  }

  const statusMap = new Map<number, 'correct' | 'wrong' | 'unplayed'>()

  // For each string in the chord
  for (const string of targetChord.stringsToPlay) {
    // Check if this string has been plucked
    const hasBeenPlucked = stringsPlucked.value.has(string)

    if (!hasBeenPlucked) {
      // Not played yet
      statusMap.set(string, 'unplayed')
    } else {
      // String was plucked and is in the target chord - mark as correct
      // Note: We only check channel (string) correctness, not note value
      // because capo settings can shift the pitch
      statusMap.set(string, 'correct')
    }
  }

  // Check for wrong strings (strings that shouldn't be played but were)
  for (const string of stringsPlucked.value) {
    if (!targetChord.stringsToPlay.has(string)) {
      statusMap.set(string, 'wrong')
    }
  }

  return statusMap
})

const statistics = computed(() => {
  const stats: ChordStat[] = []
  for (const chord of practiceChords.value) {
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

// Get chord definition with strings to play and not play
interface ChordDef {
  positions: Map<number, number> // string -> fret for pressed strings
  stringsToPlay: Set<number> // all strings that should be plucked
  stringsNotToPlay: Set<number> // strings that should NOT be plucked (marked as 'x')
}

const getChordDefinition = (chordName: string): ChordDef | null => {
  const chordData = chordsData.find(c => c.name === chordName)
  if (!chordData) return null

  const positions = new Map<number, number>()
  const stringsToPlay = new Set<number>()
  const stringsNotToPlay = new Set<number>()

  for (let string = 1; string <= 6; string++) {
    const stringKey = `string_${string}` as keyof typeof chordData
    const stringData = chordData[stringKey] as { play: boolean; fret: number; finger: number }

    if (stringData.play) {
      stringsToPlay.add(string)
      if (stringData.fret > 0) {
        positions.set(string, stringData.fret)
      }
    } else {
      stringsNotToPlay.add(string)
    }
  }

  return { positions, stringsToPlay, stringsNotToPlay }
}

// Initialize the strings played map for a chord
const initializeStringsPlayedMap = (stringsToPlay: Set<number>) => {
  stringsPlayedMap.value = new Map()
  stringPlayCount.value = 0
  for (const string of stringsToPlay) {
    stringsPlayedMap.value.set(string, false)
  }
}

// Reset the strings played map
const resetStringsPlayedMap = () => {
  for (const [string] of stringsPlayedMap.value) {
    stringsPlayedMap.value.set(string, false)
  }
  stringPlayCount.value = 0
}

// Check if user's finger positions and plucks match the current chord
const checkChordMatch = (): boolean => {
  if (!currentChordName.value) return false

  const targetChord = getChordDefinition(currentChordName.value)
  if (!targetChord) return false

  // Initialize the map if it's empty
  if (stringsPlayedMap.value.size === 0) {
    initializeStringsPlayedMap(targetChord.stringsToPlay)
  }

  console.group(`🎸 Checking Chord: ${currentChordName.value}`)

  // Check 1: All required fret positions are pressed
  console.log('Check 1: Fret Positions')
  for (const [string, fret] of targetChord.positions.entries()) {
    const fretSet = fretPositions.value.get(string)
    // Get the highest fret from the set (or undefined if no frets pressed)
    const actual = fretSet && fretSet.size > 0 ? Math.max(...Array.from(fretSet)) : undefined
    console.log(`  String ${string}: Expected fret ${fret}, Pressed frets ${fretSet ? Array.from(fretSet).join(',') : 'none'}, Using highest: ${actual}`)
    if (actual !== fret) {
      console.log(`  ❌ FAILED: String ${string} not pressed at fret ${fret}`)
      console.groupEnd()
      return false
    }
  }
  console.log('  ✅ All fret positions correct')

  // Check 2: Process plucked strings with Map-based validation
  console.log('Check 2: String Plucking Validation')
  console.log(`  Required strings: ${Array.from(targetChord.stringsToPlay).join(', ')}`)
  console.log(`  Plucked strings: ${Array.from(stringsPlucked.value).join(', ')}`)
  console.log(`  Current play count: ${stringPlayCount.value}/${targetChord.stringsToPlay.size}`)

  // Check for wrong strings (strings that shouldn't be played)
  for (const string of stringsPlucked.value) {
    // If string is not in the map at all, it's a wrong string
    if (!stringsPlayedMap.value.has(string)) {
      console.log(`  ❌ FAILED: Wrong string ${string} plucked (not in chord)`)
      console.log('  Resetting and starting over...')
      resetStringsPlayedMap()
      clearStringsPlucked()
      console.groupEnd()
      return false
    }

    // If string is in the map but hasn't been marked as played yet
    if (stringsPlayedMap.value.get(string) === false) {
      stringsPlayedMap.value.set(string, true)
      stringPlayCount.value++
      console.log(`  ✓ String ${string} played for first time (count: ${stringPlayCount.value})`)
    }
  }

  // Check 3: Have all required strings been played?
  console.log('Check 3: Completion Check')
  if (stringPlayCount.value === targetChord.stringsToPlay.size) {
    console.log(`  ✅ All ${targetChord.stringsToPlay.size} strings played!`)
    console.log('🎉 ALL CHECKS PASSED!')
    console.groupEnd()
    return true
  }

  console.log(`  ⏳ Waiting for more strings (${stringPlayCount.value}/${targetChord.stringsToPlay.size})`)
  console.groupEnd()
  return false
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
  startTime.value = null // Don't start timing until first pluck
  currentTime.value = 0

  // Reset string tracking
  stringsPlayedMap.value.clear()
  stringPlayCount.value = 0

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
const nextChord = async (time: number) => {
  // Record time for current chord
  const chord = currentChordName.value
  if (!chord) return

  if (!chordTimes.value[chord]) {
    chordTimes.value[chord] = []
  }
  chordTimes.value[chord].push(time)

  // Save transition to database
  try {
    await addChordTransition(chord, time)
  } catch (error) {
    console.error('Error saving chord transition:', error)
  }

  // Clear plucked strings for next chord
  clearStringsPlucked()

  // Reset the strings played map for next chord
  stringsPlayedMap.value.clear()
  stringPlayCount.value = 0

  // Move to next chord
  currentChordIndex.value++

  if (currentChordIndex.value >= practiceChords.value.length) {
    // Loop back to start
    currentChordIndex.value = 0
  }

  // Reset timer for next chord
  startTime.value = Date.now()
  currentTime.value = 0
}

// Watch for chord matches (check fret positions, plucks, and notes)
watch([() => fretPositions.value, () => stringsPlucked.value, () => pluckedNotes.value], () => {
  if (isStarted.value) {
    // Start timing on first pluck
    if (startTime.value === null && stringsPlucked.value.size > 0) {
      startTime.value = Date.now()
      console.log('⏱️ Timer started on first pluck')
    }

    if (startTime.value !== null && checkChordMatch()) {
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
  align-items: center;
  flex-wrap: wrap;
}

.progression-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progression-selector label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #4b5563;
}

.progression-dropdown {
  padding: 0.5rem;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  background-color: white;
  color: #1f2937;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 300px;
}

.progression-dropdown:hover:not(:disabled) {
  border-color: #4f46e5;
}

.progression-dropdown:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
  opacity: 0.6;
}

.progression-display {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.progression-display p {
  font-size: 0.875rem;
  color: #6b7280;
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

/* Debug Display */
.debug-display {
  padding: 1.5rem;
  background-color: #fffbeb;
  border: 2px solid #fbbf24;
}

.debug-display h3 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #92400e;
  margin: 0 0 1rem 0;
}

.debug-section {
  margin-bottom: 1.5rem;
}

.debug-section:last-child {
  margin-bottom: 0;
}

.debug-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #78350f;
  margin: 0 0 0.5rem 0;
}

.debug-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.debug-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem;
  background-color: #fef3c7;
  border-radius: 4px;
}

.debug-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #92400e;
}

.debug-value {
  font-size: 0.875rem;
  color: #451a03;
  font-family: monospace;
}

.debug-display .empty-message {
  font-size: 0.875rem;
  color: #78350f;
  font-style: italic;
}
</style>
