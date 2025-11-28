<template>
  <div class="fretboard-container card">
    <h2>Fretboard</h2>

    <!-- Fretboard visualization -->
    <div class="fretboard">
      <div class="fretboard-inner">
        <!-- Fret markers (top) -->
        <div class="fret-markers">
          <div class="string-label-spacer"></div>
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
                {{ getStringName(7 - string) }}
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

                <!-- Finger position indicator -->
                <div
                  v-if="isStringFretPressed(7 - string, fret)"
                  class="finger-indicator"
                >
                  <span>{{ fret }}</span>
                </div>

                <!-- Inlay markers -->
                <div
                  v-if="shouldShowInlay(fret) && string === 3"
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
interface Props {
  fretPositions: Map<number, number>
}

const props = defineProps<Props>()

const fretWidth = 80

const stringNames = ['E', 'A', 'D', 'G', 'B', 'e']

const getStringName = (stringNumber: number): string => {
  if (stringNumber >= 1 && stringNumber <= 6) {
    return `${stringNumber} (${stringNames[stringNumber - 1]})`
  }
  return `${stringNumber}`
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

.fretboard-container h2 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  text-align: center;
  margin-bottom: 1.5rem;
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

.finger-indicator {
  width: 32px;
  height: 32px;
  background-color: #ef4444;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.finger-indicator span {
  font-size: 0.75rem;
  font-weight: bold;
  color: white;
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
  left: 64px;
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
