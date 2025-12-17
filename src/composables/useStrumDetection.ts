import { ref } from 'vue'
import type { StrumEvent, StrumInstruction, StrumValidationResult } from '../types/strumming'

export function useStrumDetection() {
  // Buffer for collecting strum events
  const eventBuffer = ref<StrumEvent[]>([])
  const lastEventTime = ref<number>(0)

  // Configuration
  const GAP_THRESHOLD_MS = 100 // Time gap to consider events as separate strums

  // Add event to buffer
  function addEvent(event: StrumEvent) {
    eventBuffer.value.push(event)
    lastEventTime.value = event.timestamp
  }

  // Clear event buffer
  function clearBuffer() {
    eventBuffer.value = []
  }

  // Get events within a time window
  function getEventsInWindow(centerTime: number, windowMs: number): StrumEvent[] {
    const halfWindow = windowMs / 2
    return eventBuffer.value.filter(
      event => Math.abs(event.timestamp - centerTime) <= halfWindow
    )
  }

  // Detect strum direction using majority vote
  function detectDirection(events: StrumEvent[]): 'down' | 'up' | 'unclear' {
    if (events.length < 2) {
      console.log('🔍 Detection: Too few events (<2)')
      return 'unclear'
    }

    // Sort by timestamp
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)

    if (sorted.length === 0) return 'unclear'

    // Deduplicate consecutive identical strings
    const deduplicated = [sorted[0]!]
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.string !== sorted[i - 1]!.string) {
        deduplicated.push(sorted[i]!)
      }
    }

    console.log('🔍 Detection: Deduplicated strings:', deduplicated.map(e => e.string).join('→'))

    if (deduplicated.length < 2) {
      console.log('🔍 Detection: Too few unique strings after dedup')
      return 'unclear'
    }

    // Count transitions
    let downCount = 0 // High to low (6→5→4)
    let upCount = 0   // Low to high (1→2→3)

    for (let i = 0; i < deduplicated.length - 1; i++) {
      const diff = deduplicated[i]!.string - deduplicated[i + 1]!.string
      if (diff > 0) {
        downCount++
        console.log(`  ${deduplicated[i]!.string}→${deduplicated[i + 1]!.string}: DOWN`)
      } else if (diff < 0) {
        upCount++
        console.log(`  ${deduplicated[i]!.string}→${deduplicated[i + 1]!.string}: UP`)
      }
    }

    console.log(`🔍 Detection: Vote count - Down: ${downCount}, Up: ${upCount}`)

    // Majority vote
    if (downCount > upCount) {
      console.log('🔍 Detection: Result = DOWN (majority)')
      return 'down'
    }
    if (upCount > downCount) {
      console.log('🔍 Detection: Result = UP (majority)')
      return 'up'
    }

    // Fallback: first-to-last comparison
    const first = deduplicated[0]!.string
    const last = deduplicated[deduplicated.length - 1]!.string
    if (first > last) {
      console.log(`🔍 Detection: Result = DOWN (first ${first} > last ${last})`)
      return 'down'
    }
    if (first < last) {
      console.log(`🔍 Detection: Result = UP (first ${first} < last ${last})`)
      return 'up'
    }

    console.log('🔍 Detection: Result = UNCLEAR')
    return 'unclear'
  }

  // Calculate confidence score (0-1)
  function calculateConfidence(events: StrumEvent[], direction: 'down' | 'up'): number {
    if (events.length < 2) return 0

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)

    if (sorted.length === 0) return 0

    const deduplicated = [sorted[0]!]
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.string !== sorted[i - 1]!.string) {
        deduplicated.push(sorted[i]!)
      }
    }

    if (deduplicated.length < 2) return 0

    let correctTransitions = 0
    let totalTransitions = 0

    for (let i = 0; i < deduplicated.length - 1; i++) {
      const diff = deduplicated[i]!.string - deduplicated[i + 1]!.string
      totalTransitions++

      if (direction === 'down' && diff > 0) correctTransitions++
      else if (direction === 'up' && diff < 0) correctTransitions++
    }

    return totalTransitions > 0 ? correctTransitions / totalTransitions : 0
  }

  // Validate a strum against expected instruction
  function validateStrum(
    events: StrumEvent[],
    instruction: StrumInstruction
  ): StrumValidationResult {
    if (events.length === 0) {
      return {
        direction: 'unclear',
        confidence: 0,
        stringsPlayed: new Set(),
        wrongStrings: [],
        missedStrings: Array.from(instruction.strings),
        valid: false
      }
    }

    // Detect direction
    const detectedDirection = detectDirection(events)
    const confidence = detectedDirection !== 'unclear'
      ? calculateConfidence(events, detectedDirection)
      : 0

    // Get unique strings played
    const stringsPlayed = new Set(events.map(e => e.string))

    // Check for wrong strings (played but not expected)
    const expectedStrings = new Set(instruction.strings)
    const wrongStrings = Array.from(stringsPlayed).filter(s => !expectedStrings.has(s))

    // Check for missed strings (expected but not played)
    const missedStrings = instruction.strings.filter(s => !stringsPlayed.has(s))

    // Validation
    const directionCorrect = detectedDirection === instruction.direction
    const noWrongStrings = wrongStrings.length === 0
    const allStringsPlayed = missedStrings.length === 0

    const valid = directionCorrect && noWrongStrings && allStringsPlayed && confidence > 0.6

    return {
      direction: detectedDirection,
      confidence,
      stringsPlayed,
      wrongStrings,
      missedStrings,
      valid
    }
  }

  // Check if enough time has passed since last event to consider strum complete
  function isStrumComplete(currentTime: number): boolean {
    if (eventBuffer.value.length === 0) return false
    return currentTime - lastEventTime.value > GAP_THRESHOLD_MS
  }

  // Get and clear completed strum
  function getCompletedStrum(): StrumEvent[] {
    const strum = [...eventBuffer.value]
    clearBuffer()
    return strum
  }

  return {
    // State
    eventBuffer,
    lastEventTime,

    // Methods
    addEvent,
    clearBuffer,
    getEventsInWindow,
    detectDirection,
    calculateConfidence,
    validateStrum,
    isStrumComplete,
    getCompletedStrum
  }
}
