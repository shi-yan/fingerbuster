<template>
  <div class="chord-card" :class="{ selected: isSelected }" @click="$emit('select')">
    <div class="chord-name">{{ chordData.name }}</div>
    <svg :width="cardWidth" :height="cardHeight" class="chord-diagram">
      <!-- String status indicators (x for muted, o for open) at top -->
      <g class="string-status">
        <text
          v-for="string in 6"
          :key="`status-${string}`"
          :x="getStringX(string)"
          :y="20"
          text-anchor="middle"
          class="status-text"
        >
          {{ getStringStatus(string) }}
        </text>
      </g>

      <!-- Fret board grid -->
      <g class="fretboard" :transform="`translate(${padding}, ${topPadding})`">
        <!-- Horizontal lines (frets) -->
        <line
          v-for="fret in numFrets + 1"
          :key="`fret-${fret}`"
          :x1="0"
          :y1="(fret - 1) * fretHeight"
          :x2="stringSpacing * 5"
          :y2="(fret - 1) * fretHeight"
          stroke="#333"
          :stroke-width="fret === 1 ? 3 : 1"
        />

        <!-- Vertical lines (strings) -->
        <!-- String 6 (low E) on left, string 1 (high e) on right -->
        <line
          v-for="string in 6"
          :key="`string-${string}`"
          :x1="(6 - string) * stringSpacing"
          :y1="0"
          :x2="(6 - string) * stringSpacing"
          :y2="numFrets * fretHeight"
          stroke="#333"
          stroke-width="1"
        />

        <!-- Finger positions (colored dots with numbers) -->
        <!-- String 6 (low E) on left, string 1 (high e) on right -->
        <g v-for="position in fingerPositions" :key="`finger-${position.string}`">
          <circle
            :cx="(6 - position.string) * stringSpacing"
            :cy="position.fret * fretHeight - fretHeight / 2"
            :r="dotRadius"
            :fill="getFingerColor(position.finger)"
            stroke="#fff"
            stroke-width="2"
          />
          <text
            v-if="position.finger > 0"
            :x="(6 - position.string) * stringSpacing"
            :y="position.fret * fretHeight - fretHeight / 2 + 5"
            text-anchor="middle"
            class="finger-number"
          >
            {{ position.finger }}
          </text>
        </g>
      </g>
    </svg>

    <!-- Picking pattern display (shown when selected) -->
    <div v-if="isSelected && pickingPattern" class="picking-pattern">
      <div class="pattern-label">Picking Pattern:</div>
      <div class="pattern-numbers">
        <span v-for="(stringNum, index) in pickingPattern" :key="index" class="pattern-note">
          {{ stringNum }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ChordStringData {
  play: boolean
  fret: number
  finger: number
}

interface ChordData {
  name: string
  string_1: ChordStringData
  string_2: ChordStringData
  string_3: ChordStringData
  string_4: ChordStringData
  string_5: ChordStringData
  string_6: ChordStringData
}

interface FingerPosition {
  string: number
  fret: number
  finger: number
}

interface Props {
  chordData: ChordData
  isSelected?: boolean
  pickingPattern?: number[]
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  pickingPattern: undefined
})

defineEmits<{
  select: []
}>()

// SVG dimensions
const cardWidth = 160
const cardHeight = 200
const padding = 20
const topPadding = 40
const stringSpacing = 24
const fretHeight = 30
const numFrets = 4
const dotRadius = 10

// Get finger positions for rendering
const fingerPositions = computed<FingerPosition[]>(() => {
  const positions: FingerPosition[] = []
  for (let i = 1; i <= 6; i++) {
    const stringKey = `string_${i}` as keyof ChordData
    const stringData = props.chordData[stringKey] as ChordStringData
    if (stringData.fret > 0) {
      positions.push({
        string: i,
        fret: stringData.fret,
        finger: stringData.finger
      })
    }
  }
  return positions
})

// Get X coordinate for a string (1-6, where 1 is high E, 6 is low E)
// Standard guitar diagrams: string 6 (low E) on LEFT, string 1 (high e) on RIGHT
function getStringX(string: number): number {
  return padding + (6 - string) * stringSpacing
}

// Get string status (x for muted, o for open, empty for fretted)
function getStringStatus(string: number): string {
  const stringKey = `string_${string}` as keyof ChordData
  const stringData = props.chordData[stringKey] as ChordStringData

  if (!stringData.play) {
    return '×' // Muted string
  } else if (stringData.fret === 0) {
    return '○' // Open string
  }
  return '' // Fretted string (no marker)
}

// Get color for finger number
function getFingerColor(finger: number): string {
  const colors: Record<number, string> = {
    0: '#999', // Open (shouldn't appear as dot)
    1: '#ef4444', // Index - red
    2: '#f59e0b', // Middle - orange
    3: '#10b981', // Ring - green
    4: '#3b82f6'  // Pinky - blue
  }
  return colors[finger] || '#999'
}
</script>

<style scoped>
.chord-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-block;
}

.chord-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.chord-card.selected {
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
  border: 2px solid #3b82f6;
}

.chord-name {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  margin-bottom: 8px;
  color: #1f2937;
}

.chord-diagram {
  display: block;
  margin: 0 auto;
}

.status-text {
  font-size: 16px;
  font-weight: bold;
  fill: #374151;
}

.finger-number {
  font-size: 14px;
  font-weight: bold;
  fill: white;
  pointer-events: none;
}

.picking-pattern {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.pattern-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 6px;
  text-align: center;
}

.pattern-numbers {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.pattern-note {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background-color: #3b82f6;
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 0.875rem;
}
</style>
