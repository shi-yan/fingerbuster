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
import { sharedMidi } from '../midi'
import FretBoard from './FretBoard.vue'
import chordsData from '../data/chords.json'
import { addChordTransition } from '../db/practiceDb'

const { fretPositions, stringsPlucked, pluckOrder, pluckedNotes, clearStringsPlucked } = sharedMidi

// Base MIDI notes for each string (open strings)
const STRING_BASE_NOTES: Record<number, number> = {
  6: 40, // 6th string (E)
  5: 45, // 5th string (A)
  4: 50, // 4th string (D)
  3: 55, // 3rd string (G)
  2: 59, // 2nd string (B)
  1: 64  // 1st string (e)
}

// Calculate expected MIDI note for a string based on fret position
const getExpectedNote = (guitarString: number, fret: number): number => {
  const baseNote = STRING_BASE_NOTES[guitarString]
  if (baseNote === undefined) {
    throw new Error(`Invalid guitar string number: ${guitarString}`)
  }
  return baseNote + fret
}

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

// Validate that strings are plucked in order from 6 to 1
const validatePluckOrder = (stringsToPlay: Set<number>): boolean => {
  // Get only the plucks that are part of this chord
  const relevantPlucks = pluckOrder.value.filter(s => stringsToPlay.has(s))

  // Create sorted array of strings that should be played (6 to 1)
  const expectedOrder = Array.from(stringsToPlay).sort((a, b) => b - a)

  // Remove duplicates from relevant plucks (in case user plucked the same string twice)
  const uniquePlucks = [...new Set(relevantPlucks)]

  // Check if uniquePlucks matches expectedOrder
  if (uniquePlucks.length !== expectedOrder.length) {
    return false
  }

  for (let i = 0; i < uniquePlucks.length; i++) {
    if (uniquePlucks[i] !== expectedOrder[i]) {
      return false
    }
  }

  return true
}

// Check if user's finger positions and plucks match the current chord
const checkChordMatch = (): boolean => {
  if (!currentChordName.value) return false

  const targetChord = getChordDefinition(currentChordName.value)
  if (!targetChord) return false

  console.group(`🎸 Checking Chord: ${currentChordName.value}`)

  // Check 1: All required fret positions are pressed
  console.log('Check 1: Fret Positions')
  for (const [string, fret] of targetChord.positions.entries()) {
    const actual = fretPositions.value.get(string)
    console.log(`  String ${string}: Expected fret ${fret}, Actual fret ${actual}`)
    if (actual !== fret) {
      console.log(`  ❌ FAILED: String ${string} not pressed at fret ${fret}`)
      console.groupEnd()
      return false
    }
  }
  console.log('  ✅ All fret positions correct')

  // Check 2: All strings that should be played have been plucked (note-on)
  console.log('Check 2: Strings Plucked')
  console.log(`  Required strings: ${Array.from(targetChord.stringsToPlay).join(', ')}`)
  console.log(`  Plucked strings: ${Array.from(stringsPlucked.value).join(', ')}`)
  for (const string of targetChord.stringsToPlay) {
    if (!stringsPlucked.value.has(string)) {
      console.log(`  ❌ FAILED: String ${string} not plucked`)
      console.groupEnd()
      return false
    }
  }
  console.log('  ✅ All required strings plucked')

  // Check 3: Validate plucked notes match expected notes
  console.log('Check 3: Note Values')
  for (const string of targetChord.stringsToPlay) {
    const fret = targetChord.positions.get(string) || 0 // 0 for open strings
    const expectedNote = getExpectedNote(string, fret)
    const actualNote = pluckedNotes.value.get(string)

    console.log(`  String ${string} (fret ${fret}): Expected note ${expectedNote}, Actual note ${actualNote}`)
    if (actualNote !== expectedNote) {
      console.log(`  ❌ FAILED: Wrong note on string ${string}`)
      console.groupEnd()
      return false // Wrong note! Fret position doesn't match pluck
    }
  }
  console.log('  ✅ All note values correct')

  // Check 4: No strings that shouldn't be played have been plucked
  console.log('Check 4: Wrong Strings')
  console.log(`  Should NOT play: ${Array.from(targetChord.stringsNotToPlay).join(', ') || 'None'}`)
  for (const string of targetChord.stringsNotToPlay) {
    if (stringsPlucked.value.has(string)) {
      console.log(`  ❌ FAILED: String ${string} should not be plucked but was`)
      console.groupEnd()
      return false // Wrong! User plucked a string they shouldn't have
    }
  }
  console.log('  ✅ No wrong strings plucked')

  // Check 5: No extra strings are plucked (only the ones in stringsToPlay)
  console.log('Check 5: Extra Strings')
  for (const string of stringsPlucked.value) {
    if (!targetChord.stringsToPlay.has(string)) {
      console.log(`  ❌ FAILED: Extra string ${string} plucked`)
      console.groupEnd()
      return false
    }
  }
  console.log('  ✅ No extra strings plucked')

  // Check 6: Strings are plucked in correct order (6 to 1)
  console.log('Check 6: Pluck Order')
  console.log(`  Expected order: ${Array.from(targetChord.stringsToPlay).sort((a, b) => b - a).join(' → ')}`)
  console.log(`  Actual order: ${pluckOrder.value.filter(s => targetChord.stringsToPlay.has(s)).join(' → ')}`)
  if (!validatePluckOrder(targetChord.stringsToPlay)) {
    console.log('  ❌ FAILED: Wrong pluck order')
    console.groupEnd()
    return false
  }
  console.log('  ✅ Correct pluck order')

  console.log('🎉 ALL CHECKS PASSED!')
  console.groupEnd()
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

// Watch for chord matches (check fret positions, plucks, and notes)
watch([() => fretPositions.value, () => stringsPlucked.value, () => pluckedNotes.value], () => {
  if (isStarted.value && startTime.value) {
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
