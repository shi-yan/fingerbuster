<template>
  <div class="fretboard-container card">
    <div class="header-section">
      <h2>Fretboard</h2>

      <!-- Chord selection buttons -->
      <div class="chord-buttons">
        <button
          v-for="chordName in Object.keys(chords)"
          :key="chordName"
          @click="selectChord(chordName)"
          class="chord-button"
          :class="{ active: selectedChord === chordName }"
        >
          {{ chordName }}
        </button>
        <button
          @click="clearChord"
          class="chord-button clear-button"
          :class="{ active: selectedChord === null }"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Fretboard visualization -->
    <div class="fretboard">
      <div class="fretboard-inner">
        <!-- Fret markers (top) -->
        <div class="fret-markers">
          <div class="string-label-spacer"></div>
          <div class="play-indicator-spacer"></div>
          <div
            v-for="fret in 12"
            :key="`marker-${fret}`"
            class="fret-marker"
            :style="{ width: fretWidth + 'px' }"
          >
            {{ fret }}
          </div>
        </div>

        <!-- Strings and frets -->
        <div class="strings-container">
          <div
            v-for="string in 6"
            :key="`string-${string}`"
            class="string-row"
          >
            <!-- String number label -->
            <div class="string-label">
              <span>
                {{ getStringName(string) }}
              </span>
            </div>

            <!-- Play indicator (X or O) -->
            <div class="play-indicator">
              <span v-if="currentChord">
                {{ getPlayIndicator(string) }}
              </span>
            </div>

            <!-- Frets -->
            <div class="frets-row">
              <!-- String line -->
              <div
                class="string-line"
                :style="{ width: (fretWidth * 12) + 'px' }"
              ></div>

              <!-- Frets -->
              <div
                v-for="fret in 12"
                :key="`fret-${string}-${fret}`"
                class="fret-cell"
                :style="{ width: fretWidth + 'px' }"
              >
                <!-- Fret line -->
                <div
                  class="fret-line"
                  :class="{ 'last-fret': fret === 12 }"
                ></div>

                <!-- User finger position (gray semi-transparent) -->
                <div
                  v-if="isStringFretPressed(string, fret) && !isChordPosition(string, fret)"
                  class="user-finger-indicator"
                >
                </div>

                <!-- Chord position indicator (with finger number label) -->
                <div
                  v-if="isChordPosition(string, fret)"
                  class="chord-indicator"
                >
                  <span>{{ getFingerNumber(string, fret) }}</span>
                </div>

                <!-- User finger on chord position (show both) -->
                <div
                  v-if="isStringFretPressed(string, fret) && isChordPosition(string, fret)"
                  class="user-finger-on-chord"
                >
                </div>

                <!-- Inlay markers -->
                <div
                  v-if="shouldShowInlay(fret) && string === 4"
                  class="inlay-marker"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Nut (left edge) -->
        <div class="nut"></div>
      </div>
    </div>

    <!-- Current finger positions display -->
    <div class="positions-display">
      <h3>Current Finger Positions:</h3>
      <div class="positions-grid">
        <div v-if="fretPositions.size === 0" class="empty-message">
          No strings pressed
        </div>
        <div v-else class="positions-list">
          <div
            v-for="[string, fret] in Array.from(fretPositions.entries())"
            :key="`position-${string}`"
            class="position-item"
          >
            <span class="position-string">{{ getStringName(string) }}:</span>
            <span class="position-fret">Fret {{ fret }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import chordsData from '../data/chords.json'

interface Props {
  fretPositions: Map<number, number>
}

interface ChordPosition {
  fret: number
  finger: number
}

interface Chord {
  name: string
  positions: (ChordPosition | 'x' | null)[] // null = open string (0), 'x' = don't play
}

interface ChordStringData {
  play: boolean
  fret: number
  finger: number
}

interface ChordJson {
  name: string
  string_1: ChordStringData
  string_2: ChordStringData
  string_3: ChordStringData
  string_4: ChordStringData
  string_5: ChordStringData
  string_6: ChordStringData
}

const props = defineProps<Props>()

const fretWidth = 80

// String names from 1st (high e) to 6th (low E)
const stringNames = ['e', 'B', 'G', 'D', 'A', 'E']

// Convert JSON chord data to internal format
const convertChordData = (jsonChord: ChordJson): Chord => {
  const stringData = [
    jsonChord.string_1,
    jsonChord.string_2,
    jsonChord.string_3,
    jsonChord.string_4,
    jsonChord.string_5,
    jsonChord.string_6
  ]

  const positions = stringData.map(str => {
    if (!str.play) return 'x'
    if (str.fret === 0) return null
    return { fret: str.fret, finger: str.finger }
  })

  return {
    name: jsonChord.name,
    positions: positions as (ChordPosition | 'x' | null)[]
  }
}

// Load chords from JSON
const chords: Record<string, Chord> = {}
chordsData.forEach((jsonChord: ChordJson) => {
  chords[jsonChord.name] = convertChordData(jsonChord)
})

const selectedChord = ref<string | null>(null)

const currentChord = computed(() => {
  return selectedChord.value ? chords[selectedChord.value] : null
})

const selectChord = (chordName: string) => {
  selectedChord.value = chordName
}

const clearChord = () => {
  selectedChord.value = null
}

const getStringName = (stringNumber: number): string => {
  if (stringNumber >= 1 && stringNumber <= 6) {
    return `${stringNumber} (${stringNames[stringNumber - 1]})`
  }
  return `${stringNumber}`
}

const getPlayIndicator = (stringNumber: number): string => {
  if (!currentChord.value) return ''
  const position = currentChord.value.positions[stringNumber - 1]
  if (position === 'x') return 'X'
  return 'O'
}

const isChordPosition = (string: number, fret: number): boolean => {
  if (!currentChord.value) return false
  const position = currentChord.value.positions[string - 1]
  if (!position || position === 'x') return false
  return (position as ChordPosition).fret === fret
}

const getFingerNumber = (string: number, _fret: number): number => {
  if (!currentChord.value) return 0
  const position = currentChord.value.positions[string - 1]
  if (!position || position === 'x') return 0
  return (position as ChordPosition).finger
}

const isStringFretPressed = (string: number, fret: number): boolean => {
  return props.fretPositions.get(string) === fret
}

const shouldShowInlay = (fret: number): boolean => {
  return [3, 5, 7, 9].includes(fret) || fret === 12
}
</script>

<style scoped>
.fretboard-container {
  max-width: 1200px;
  margin: 0 auto;
}

.header-section {
  margin-bottom: 1.5rem;
}

.fretboard-container h2 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  text-align: center;
  margin-bottom: 1rem;
}

.chord-buttons {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chord-button {
  padding: 0.5rem 1rem;
  background-color: #e5e7eb;
  color: #1f2937;
  border: 2px solid transparent;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.chord-button:hover {
  background-color: #d1d5db;
}

.chord-button.active {
  background-color: #4f46e5;
  color: white;
  border-color: #4338ca;
}

.chord-button.clear-button.active {
  background-color: #6b7280;
  border-color: #4b5563;
}

.fretboard {
  position: relative;
  background-color: #b45309;
  border-radius: 8px;
  padding: 1.5rem;
  overflow-x: auto;
}

.fretboard-inner {
  min-width: max-content;
}

.fret-markers {
  display: flex;
  margin-bottom: 0.5rem;
}

.string-label-spacer {
  width: 64px;
  flex-shrink: 0;
}

.play-indicator-spacer {
  width: 32px;
  flex-shrink: 0;
}

.fret-marker {
  flex-shrink: 0;
  text-align: center;
  font-size: 0.75rem;
  color: #fef3c7;
  font-weight: 600;
}

.strings-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.string-row {
  display: flex;
  align-items: center;
}

.string-label {
  width: 64px;
  flex-shrink: 0;
  text-align: right;
  padding-right: 1rem;
}

.string-label span {
  font-size: 0.875rem;
  font-weight: bold;
  color: #fef3c7;
}

.play-indicator {
  width: 32px;
  flex-shrink: 0;
  text-align: center;
}

.play-indicator span {
  font-size: 1.25rem;
  font-weight: bold;
  color: #fef3c7;
}

.frets-row {
  display: flex;
  align-items: center;
  position: relative;
}

.string-line {
  position: absolute;
  height: 2px;
  background-color: #d1d5db;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

.fret-cell {
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
}

.fret-line {
  position: absolute;
  right: 0;
  width: 4px;
  height: 100%;
  background-color: #9ca3af;
}

.fret-line.last-fret {
  background-color: #d1d5db;
}

/* User finger position - gray semi-transparent */
.user-finger-indicator {
  width: 32px;
  height: 32px;
  background-color: rgba(107, 114, 128, 0.5);
  border-radius: 50%;
  border: 2px solid rgba(107, 114, 128, 0.7);
  z-index: 5;
  position: absolute;
}

/* Chord position - with finger number */
.chord-indicator {
  width: 32px;
  height: 32px;
  background-color: #3b82f6;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chord-indicator span {
  font-size: 0.875rem;
  font-weight: bold;
  color: white;
}

/* User finger on chord position - gray behind chord */
.user-finger-on-chord {
  width: 38px;
  height: 38px;
  background-color: rgba(34, 197, 94, 0.4);
  border-radius: 50%;
  border: 2px solid rgba(34, 197, 94, 0.6);
  z-index: 8;
  position: absolute;
}

.inlay-marker {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: #fde68a;
  border-radius: 50%;
  opacity: 0.5;
}

.nut {
  position: absolute;
  left: 96px;
  top: 48px;
  width: 8px;
  background-color: #1f2937;
  border-radius: 2px;
  height: calc(100% - 96px);
}

.positions-display {
  margin-top: 1.5rem;
}

.positions-display h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.positions-grid {
  background-color: #f3f4f6;
  padding: 1rem;
  border-radius: 8px;
}

.empty-message {
  color: #9ca3af;
  font-style: italic;
}

.positions-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
}

.position-item {
  background: white;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #d1d5db;
}

.position-string {
  font-weight: 600;
}

.position-fret {
  margin-left: 0.5rem;
  color: #2563eb;
}
</style>
