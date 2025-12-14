<template>
  <div class="practice-mode">
    <div class="practice-header card">
      <h2>Practice Mode</h2>
    </div>

    <!-- Chord Builder Section -->
    <div v-if="!isStarted" class="chord-builder card">
      <h3>Build Your Chord Progression</h3>

      <!-- Preset Progressions Dropdown and Save Controls -->
      <div class="builder-controls">
        <div class="preset-selector">
          <label for="preset">Load Preset:</label>
          <select
            id="preset"
            v-model="selectedPresetIndex"
            @change="loadPreset"
            class="preset-dropdown"
          >
            <option :value="-1">-- Select a progression --</option>
            <optgroup label="Default Progressions">
              <option
                v-for="(prog, index) in defaultProgressions"
                :key="`default-${index}`"
                :value="index"
              >
                {{ prog.name }}
              </option>
            </optgroup>
            <optgroup v-if="savedProgressions.length > 0" label="Saved Progressions">
              <option
                v-for="(prog, index) in savedProgressions"
                :key="`saved-${prog.id}`"
                :value="defaultProgressions.length + index"
              >
                {{ prog.name }}
              </option>
            </optgroup>
          </select>
        </div>

        <div class="save-controls">
          <input
            v-model="progressionName"
            type="text"
            placeholder="Progression name..."
            class="progression-name-input"
          />
          <button
            @click="saveCustomProgression"
            :disabled="customProgression.length === 0 || !progressionName.trim()"
            class="btn-save"
          >
            Save Progression
          </button>
        </div>
      </div>

      <!-- Available Chords (Row 1) -->
      <div class="available-chords-section">
        <h4>Available Chords (drag to add)</h4>
        <div class="chords-row available-chords">
          <div
            v-for="chord in availableChords"
            :key="chord"
            draggable="true"
            @dragstart="onDragStart($event, chord)"
            class="chord-item available"
          >
            {{ chord }}
          </div>
        </div>
      </div>

      <!-- Custom Progression (Row 2) -->
      <div class="custom-progression-section">
        <div class="section-header">
          <h4>Your Custom Progression</h4>
          <button
            v-if="customProgression.length > 0"
            @click="clearProgression"
            class="btn-clear"
          >
            Clear All
          </button>
        </div>
        <div
          class="chords-row custom-progression"
          @drop="onDropToProgression($event)"
          @dragover="onDragOver($event)"
          :class="{ empty: customProgression.length === 0 }"
        >
          <div
            v-if="customProgression.length === 0"
            class="empty-placeholder"
          >
            Drag chords here to build your progression
          </div>
          <div
            v-for="(chord, index) in customProgression"
            :key="`progression-${index}`"
            draggable="true"
            @dragstart="onDragStartFromProgression($event, index)"
            @drop="onDropReorder($event, index)"
            @dragover="onDragOver($event)"
            class="chord-item custom"
          >
            <span class="chord-label">{{ chord }}</span>
            <button
              @click="removeChord(index)"
              class="remove-btn"
              title="Remove"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <!-- Start Practice Button -->
      <div class="start-practice-section">
        <button
          @click="startPractice"
          :disabled="customProgression.length === 0"
          class="btn-primary btn-large"
        >
          Start Practice ({{ customProgression.length }} chords)
        </button>
      </div>
    </div>

    <!-- Practice Session Display -->
    <div v-if="isStarted" class="current-chord-display card">
      <h3>Current Chord: <span class="chord-name">{{ currentChordName }}</span></h3>
      <div class="progress-info">
        <p>Progress: {{ currentChordIndex + 1 }} / {{ customProgression.length }}</p>
        <p v-if="startTime">Time: {{ currentTime.toFixed(2) }}s</p>
      </div>
      <div class="progression-display">
        <p>Progression: {{ customProgression.join(' → ') }}</p>
      </div>
      <div class="stop-practice-section">
        <button
          @click="stopPractice"
          class="btn-danger"
        >
          Stop Practice
        </button>
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
import { ref, computed, watch, onMounted } from 'vue'
import { sharedMidi } from '../composables/useMidi'
import FretBoard from './FretBoard.vue'
import chordsData from '../data/chords.json'
import { addChordTransition, getAllSavedProgressions, saveProgression, type SavedProgression } from '../db/practiceDb'

const { fretPositions, stringsPlucked, pluckOrder, pluckedNotes, clearStringsPlucked } = sharedMidi

// localStorage key for custom progression
const STORAGE_KEY_PROGRESSION = 'practice-custom-progression'

// Available chords from chords.json
const availableChords = ref<string[]>(chordsData.map(c => c.name))

// Custom progression built by user
const customProgression = ref<string[]>([])

// Progression name for saving
const progressionName = ref('')

// Default chord progressions
interface Progression {
  name: string
  chords: string[]
}

const defaultProgressions: Progression[] = [
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

// Saved progressions from IndexedDB
const savedProgressions = ref<SavedProgression[]>([])

// Selected preset index
const selectedPresetIndex = ref(-1)

// Load saved progressions from IndexedDB
const loadSavedProgressions = async () => {
  savedProgressions.value = await getAllSavedProgressions()
}

// Load a preset progression
const loadPreset = () => {
  if (selectedPresetIndex.value === -1) return

  if (selectedPresetIndex.value < defaultProgressions.length) {
    // Load default progression
    const preset = defaultProgressions[selectedPresetIndex.value]
    if (preset) {
      customProgression.value = [...preset.chords]
      progressionName.value = preset.name
    }
  } else {
    // Load saved progression
    const savedIndex = selectedPresetIndex.value - defaultProgressions.length
    const saved = savedProgressions.value[savedIndex]
    if (saved) {
      customProgression.value = [...saved.chords]
      progressionName.value = saved.name
    }
  }
}

// Save custom progression to IndexedDB
const saveCustomProgression = async () => {
  if (customProgression.value.length === 0 || !progressionName.value.trim()) return

  try {
    await saveProgression(progressionName.value.trim(), customProgression.value)
    await loadSavedProgressions()
    alert(`Progression "${progressionName.value}" saved successfully!`)
  } catch (error) {
    console.error('Error saving progression:', error)
    alert('Failed to save progression. Please try again.')
  }
}

// Clear custom progression
const clearProgression = () => {
  customProgression.value = []
  progressionName.value = ''
  selectedPresetIndex.value = -1
}

// Remove a chord from custom progression
const removeChord = (index: number) => {
  customProgression.value.splice(index, 1)
}

// Drag and drop handlers
let draggedChord: string | null = null
let draggedIndex: number | null = null

const onDragStart = (event: DragEvent, chord: string) => {
  draggedChord = chord
  draggedIndex = null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
  }
}

const onDragStartFromProgression = (event: DragEvent, index: number) => {
  draggedIndex = index
  draggedChord = customProgression.value[index] || null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = draggedIndex !== null ? 'move' : 'copy'
  }
}

const onDropToProgression = (event: DragEvent) => {
  event.preventDefault()
  if (draggedChord) {
    if (draggedIndex !== null) {
      // Moving within progression - add at end
      customProgression.value.push(draggedChord)
    } else {
      // Adding from available chords
      customProgression.value.push(draggedChord)
    }
  }
  draggedChord = null
  draggedIndex = null
}

const onDropReorder = (event: DragEvent, targetIndex: number) => {
  event.preventDefault()
  event.stopPropagation()

  if (draggedIndex !== null && draggedIndex !== targetIndex) {
    // Reordering within progression
    const movedChord = customProgression.value[draggedIndex]
    if (movedChord) {
      customProgression.value.splice(draggedIndex, 1)

      // Adjust target index if needed
      const adjustedIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex
      customProgression.value.splice(adjustedIndex, 0, movedChord)
    }
  } else if (draggedChord && draggedIndex === null) {
    // Adding from available chords at specific position
    customProgression.value.splice(targetIndex, 0, draggedChord)
  }

  draggedChord = null
  draggedIndex = null
}

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
  return customProgression.value[currentChordIndex.value] || ''
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
  for (const chord of customProgression.value) {
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
  if (customProgression.value.length === 0) return

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

  if (currentChordIndex.value >= customProgression.value.length) {
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

// Watch for changes to custom progression and save to localStorage
watch(customProgression, (newProgression) => {
  localStorage.setItem(STORAGE_KEY_PROGRESSION, JSON.stringify(newProgression))
  console.log(`💾 Saved custom progression to localStorage: ${newProgression.join(', ')}`)
}, { deep: true })

// Load saved progressions on mount
onMounted(() => {
  loadSavedProgressions()

  // Restore custom progression from localStorage
  const savedProgression = localStorage.getItem(STORAGE_KEY_PROGRESSION)
  if (savedProgression) {
    try {
      const parsed = JSON.parse(savedProgression)
      if (Array.isArray(parsed) && parsed.length > 0) {
        customProgression.value = parsed
        console.log(`✅ Restored custom progression from localStorage: ${parsed.join(', ')}`)
      }
    } catch (e) {
      console.error('Failed to parse saved progression from localStorage', e)
    }
  }
})
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
  padding: 1.5rem;
}

.practice-header h2 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0;
}

/* Chord Builder */
.chord-builder {
  padding: 1.5rem;
}

.chord-builder h3 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.builder-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-start;
}

.preset-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 300px;
}

.preset-selector label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #4b5563;
  white-space: nowrap;
}

.preset-dropdown {
  padding: 0.5rem;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  background-color: white;
  color: #1f2937;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.preset-dropdown:hover {
  border-color: #4f46e5;
}

.save-controls {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: 300px;
}

.progression-name-input {
  padding: 0.5rem;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  flex: 1;
  transition: border-color 0.2s;
}

.progression-name-input:focus {
  outline: none;
  border-color: #4f46e5;
}

.btn-save {
  padding: 0.5rem 1rem;
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-save:hover:not(:disabled) {
  background-color: #059669;
}

.btn-save:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

/* Chord Rows */
.available-chords-section,
.custom-progression-section {
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.available-chords-section h4,
.custom-progression-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #4b5563;
  margin: 0 0 0.75rem 0;
}

.chords-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  min-height: 60px;
  padding: 0.75rem;
  border-radius: 8px;
  border: 2px dashed #d1d5db;
}

.available-chords {
  background-color: #f9fafb;
  border-color: #9ca3af;
}

.custom-progression {
  background-color: #eff6ff;
  border-color: #3b82f6;
  transition: all 0.3s;
}

.custom-progression.empty {
  justify-content: center;
  align-items: center;
}

.empty-placeholder {
  color: #9ca3af;
  font-size: 0.875rem;
  font-style: italic;
  text-align: center;
}

.chord-item {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: move;
  transition: all 0.2s;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chord-item.available {
  background-color: #e0e7ff;
  color: #4f46e5;
  border: 2px solid #4f46e5;
}

.chord-item.available:hover {
  background-color: #c7d2fe;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);
}

.chord-item.custom {
  background-color: #dbeafe;
  color: #1e40af;
  border: 2px solid #3b82f6;
  position: relative;
}

.chord-item.custom:hover {
  background-color: #bfdbfe;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
}

.chord-label {
  flex: 1;
}

.remove-btn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background-color: #ef4444;
  color: white;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.2s;
}

.remove-btn:hover {
  background-color: #dc2626;
  transform: scale(1.1);
}

.btn-clear {
  padding: 0.5rem 1rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear:hover {
  background-color: #dc2626;
}

.start-practice-section {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background-color: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: #4338ca;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(79, 70, 229, 0.3);
}

.btn-primary:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}

.btn-danger {
  padding: 0.75rem 1.5rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover {
  background-color: #dc2626;
}

/* Practice Display */
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

.progression-display {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.progression-display p {
  font-size: 0.875rem;
  color: #6b7280;
}

.stop-practice-section {
  margin-top: 1rem;
}

/* Statistics */
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
