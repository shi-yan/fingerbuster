# CLAUDE.md - Development Guide for AI Assistants

This document contains architecture decisions, design patterns, and important implementation details for AI assistants working on the FingerBuster project.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Key Design Decisions](#key-design-decisions)
- [Data Structures](#data-structures)
- [MIDI Event Handling](#midi-event-handling)
- [Component Relationships](#component-relationships)
- [Common Pitfalls](#common-pitfalls)
- [Extension Points](#extension-points)

## Architecture Overview

### Singleton Pattern for MIDI State

The application uses a **singleton pattern** for MIDI state management via `useMidi()`:

```typescript
// src/composables/useMidi.ts
export function useMidi() { ... }
export const sharedMidi = useMidi() // Singleton instance
```

**Why?** All components need to share the same MIDI state. Multiple instances would lead to:
- Duplicate event listeners
- Inconsistent state across components
- Memory leaks from multiple WebMIDI connections

**Usage:**
```typescript
import { sharedMidi } from '../composables/useMidi'
const { fretPositions, stringsPlucked, ... } = sharedMidi
```

### Reactive State with Vue Refs

All MIDI state is stored in Vue `ref()` objects for reactivity:

```typescript
const fretPositions = ref<Map<number, Set<number>>>(new Map())
const stringsPlucked = ref<Set<number>>(new Set())
```

**Important:** To trigger reactivity when mutating Maps/Sets, you must:
1. **Correct:** Create new instance: `stringsPlucked.value = new Set()`
2. **Incorrect:** Mutate in place: `stringsPlucked.value.clear()` (won't trigger reactivity)

## Key Design Decisions

### 1. Fret Position Data Structure

**Decision:** `Map<number, Set<number>>` instead of `Map<number, number>`

```typescript
// OLD (incorrect): Map<string, fret>
Map<number, number>  // ❌ Can only track one fret per string

// NEW (correct): Map<string, Set<frets>>
Map<number, Set<number>>  // ✅ Tracks all pressed frets per string
```

**Rationale:**
- **Barre chords** (like F) require pressing multiple frets on the same string simultaneously
- The index finger forms a barre at fret 1, while other fingers press higher frets
- With the old structure, pressing fret 3 would overwrite fret 1, breaking the barre
- With the new structure, both fret 1 and fret 3 coexist in the Set
- **Validation uses the highest fret** from the Set: `Math.max(...Array.from(fretSet))`

**Example - F Chord:**
```typescript
// String 1: Both fret 1 (barre) and fret 1 (finger 1) pressed
fretPositions.get(1) // Set {1}

// String 4: Fret 1 (barre) AND fret 3 (finger 4) pressed
fretPositions.get(4) // Set {1, 3}  ← Uses 3 for validation
```

### 2. MIDI Channel Mapping

**Control Change (Fret Press/Release):**
```
MIDI Channel → Guitar String (1:1 mapping)
Channel 1 → String 1 (high e)
Channel 6 → String 6 (low E)
```

**Note On/Off (String Plucks):**
```
MIDI Channel → Guitar String (INVERTED mapping)
Channel 1 → String 6 (low E)
Channel 6 → String 1 (high e)
```

**Why the inversion?** MIDI guitar hardware convention.

### 3. Auto-Clear Timer for Plucked Strings

Plucked strings automatically clear after 1 second of inactivity:

```typescript
const AUTO_CLEAR_DELAY = 1000 // 1 second

// Reset timer on each pluck
resetAutoClearTimer()
```

**Rationale:**
- Prevents stale plucking state between chord changes
- Provides visual feedback that the pluck was registered
- Allows time for user to complete strumming all strings

### 4. Chord Validation Logic

The chord validation follows this sequence:

```typescript
function checkChordMatch(): boolean {
  // 1. Validate fret positions (use HIGHEST fret from each Set)
  for (const [string, expectedFret] of targetChord.positions) {
    const fretSet = fretPositions.value.get(string)
    const actualFret = fretSet ? Math.max(...Array.from(fretSet)) : undefined
    if (actualFret !== expectedFret) return false
  }
  
  // 2. Track plucked strings (prevent wrong strings)
  for (const string of stringsPlucked.value) {
    if (!stringsPlayedMap.value.has(string)) {
      // Wrong string! Reset and start over
      resetStringsPlayedMap()
      return false
    }
  }
  
  // 3. Check completion (all required strings plucked)
  return stringPlayCount.value === targetChord.stringsToPlay.size
}
```

**Key Points:**
- Fret validation happens FIRST (must have correct fingers down)
- Plucking wrong string resets the pluck tracking but NOT finger positions
- User can keep fingers in place and re-pluck correctly

## Data Structures

### ChordDef Structure

```typescript
interface ChordDef {
  positions: Map<number, number>      // string → fret for pressed strings
  stringsToPlay: Set<number>          // all strings that should be plucked
  stringsNotToPlay: Set<number>       // strings marked as 'x' (muted)
}
```

**Example - C Chord:**
```typescript
{
  positions: Map {
    2 → 1,  // String 2, fret 1
    4 → 2,  // String 4, fret 2
    5 → 3   // String 5, fret 3
  },
  stringsToPlay: Set {1, 2, 3, 4, 5},  // All except string 6
  stringsNotToPlay: Set {6}             // Don't play string 6
}
```

### MIDI Message Structure

```typescript
interface MidiMessage {
  timestamp: string    // HH:MM:SS format
  portName: string     // MIDI device name
  messageType: string  // "Note ON", "CC", etc.
  detail: string       // Human-readable description
  color: string        // CSS class for log coloring
  channel?: number     // MIDI channel (1-16)
  controller?: number  // CC number (for CC messages)
  value?: number       // CC/Note value
}
```

## MIDI Event Handling

### CC 49: Finger Press

```typescript
if (data1 === 49) {  // CC 49 = finger press
  if (data2 === 0) {
    // Open string - clear ALL frets for this string
    fretPositions.value.delete(channel)
  } else {
    // Add fret to the set for this string
    if (!fretPositions.value.has(channel)) {
      fretPositions.value.set(channel, new Set())
    }
    fretPositions.value.get(channel)!.add(data2)
  }
}
```

### CC 50: Finger Release

```typescript
if (data1 === 50) {  // CC 50 = finger release
  if (fretPositions.value.has(channel)) {
    fretPositions.value.get(channel)!.delete(data2)
    
    // Clean up empty sets
    if (fretPositions.value.get(channel)!.size === 0) {
      fretPositions.value.delete(channel)
    }
  }
}
```

### Note On: String Pluck

```typescript
if (data2 > 0) {  // Note ON (velocity > 0)
  const guitarString = 7 - channel  // Inverted mapping
  
  // Trigger reactivity by creating NEW Set
  stringsPlucked.value = new Set(stringsPlucked.value)
  stringsPlucked.value.add(guitarString)
  
  pluckOrder.value.push(guitarString)
  pluckedNotes.value.set(guitarString, data1)
  
  resetAutoClearTimer()  // Auto-clear after 1 second
}
```

## Component Relationships

### Component Hierarchy

```
App.vue
├── MidiConnection.vue (uses sharedMidi)
├── ChordPractice.vue (uses sharedMidi)
│   └── FretBoard.vue
├── PracticeMode.vue (uses sharedMidi)
│   └── FretBoard.vue
├── PluckingPractice.vue (uses sharedMidi)
└── ProgressChart.vue (uses practiceDb)
```

### Data Flow

```
MIDI Device
    ↓
Web MIDI API
    ↓
useMidi.onMIDIMessage()
    ↓
Update Reactive State (fretPositions, stringsPlucked)
    ↓
Vue Reactivity
    ↓
Components Re-render
```

## Common Pitfalls

### 1. ❌ Forgetting to Trigger Reactivity

```typescript
// WRONG - Won't trigger reactivity
stringsPlucked.value.clear()
stringsPlucked.value.add(guitarString)

// CORRECT - Triggers reactivity
stringsPlucked.value = new Set()
// OR
stringsPlucked.value = new Set(stringsPlucked.value)
stringsPlucked.value.add(guitarString)
```

### 2. ❌ Using Wrong Data Structure for Fret Positions

```typescript
// WRONG - Can't handle barre chords
const fretPositions = ref<Map<number, number>>(new Map())

// CORRECT - Handles multiple frets per string
const fretPositions = ref<Map<number, Set<number>>>(new Map())
```

### 3. ❌ Not Filtering Avoided Strings in Plucking Practice

```typescript
// WRONG - Can generate consecutive duplicates
function generateRandomStrings(avoidString) {
  const selected = shuffle([1,2,3,4,5,6]).slice(0, count)
  if (avoidString && selected[0] === avoidString && count > 1) {
    swap(selected[0], selected[1])  // ❌ Doesn't work when count = 1
  }
  return selected
}

// CORRECT - Filter before shuffling
function generateRandomStrings(avoidString) {
  let available = [1,2,3,4,5,6]
  if (avoidString !== null) {
    available = available.filter(s => s !== avoidString)
  }
  return shuffle(available).slice(0, count)
}
```

### 4. ❌ Incorrect Finger Numbering

**Guitar finger numbering convention:**
- 0 = No finger (open string)
- 1 = Index finger
- 2 = Middle finger
- 3 = Ring finger
- 4 = Pinky finger

**Example - A Chord (CORRECT):**
```json
{
  "string_2": { "fret": 2, "finger": 4 },  // Pinky
  "string_3": { "fret": 2, "finger": 3 },  // Ring
  "string_4": { "fret": 2, "finger": 2 }   // Middle
}
```

**NOT 4,3,2 from top to bottom - that's upside down!**

## Extension Points

### Adding New Practice Modes

1. Create new component in `src/components/`
2. Import `sharedMidi` from `useMidi`
3. Use reactive state: `fretPositions`, `stringsPlucked`, etc.
4. Add route in `App.vue`
5. Implement validation logic using existing patterns

### Adding New Chord Types

**Simple Chords:**
```json
{
  "name": "ChordName",
  "string_1": { "play": true, "fret": X, "finger": Y },
  ...
}
```

**Barre Chords:**
```json
{
  "name": "BarreChord",
  "barre": {
    "fret": 1,
    "startString": 6,
    "endString": 1,
    "finger": 1
  },
  "string_1": { "play": true, "fret": 1, "finger": 1 },
  ...
}
```

### Extending MIDI Support

To support different MIDI guitar brands/models:

1. Update `onMIDIMessage()` in `useMidi.ts`
2. Add new CC mappings or Note mappings
3. Document the protocol in README.md
4. Consider adding a settings panel for user configuration

### Adding New Visualizations

Use D3.js for complex visualizations:

1. Install types: `@types/d3`
2. Import D3: `import * as d3 from 'd3'`
3. Use `ref<SVGSVGElement>()` for D3 targets
4. Clean up D3 selections in `onUnmounted()`

Example pattern:
```typescript
const chartRef = ref<SVGSVGElement | null>(null)

onMounted(() => {
  if (chartRef.value) {
    const svg = d3.select(chartRef.value)
    // Build visualization
  }
})

onUnmounted(() => {
  d3.select(chartRef.value).selectAll('*').remove()
})
```

## Testing Considerations

### MIDI Device Simulation

For testing without a MIDI guitar:

1. Use virtual MIDI ports (e.g., loopMIDI on Windows, IAC Driver on Mac)
2. Send test MIDI messages using a MIDI controller app
3. Or build a test harness that programmatically sends Web MIDI messages

### Key Test Cases

**Fret Position Tracking:**
- Press multiple frets on same string → Set should contain all frets
- Release specific fret → Only that fret removed from Set
- Press then release all frets → String entry deleted from Map

**Chord Validation:**
- All fingers in correct position + all strings plucked → Pass
- Wrong string plucked → Fail, reset pluck tracking
- Missing required string → Fail, wait for more plucks
- Extra string plucked → Fail immediately

**Plucking Practice:**
- Single string mode: No consecutive duplicates
- Multi-string mode: Correct order validation
- Wrong string → Visual feedback, don't advance

## Performance Considerations

### Reactive State Updates

Minimize re-renders by:
- Using `computed()` for derived state
- Batching state updates when possible
- Not creating unnecessary reactive objects

### MIDI Message Volume

MIDI guitars can send hundreds of messages per second:
- Message log limited to 100 entries (circular buffer)
- Auto-clear timers prevent memory leaks
- Debounce expensive operations

### IndexedDB Operations

- Use transactions for bulk operations
- Batch writes to reduce I/O
- Index by `dateId` for efficient queries

## Debugging Tips

### Enable Verbose Logging

All chord validation logic includes detailed `console.log()` statements:

```typescript
console.group(`🎸 Checking Chord: ${currentChordName.value}`)
console.log('Check 1: Fret Positions')
// ... detailed logs
console.groupEnd()
```

Check browser console for detailed validation flow.

### MIDI Monitor

The MidiConnection component shows all MIDI messages in real-time with color coding:
- Green: Note ON
- Orange: Note OFF
- Blue: Control Change
- Purple: System messages

### Debug Panel

PracticeMode includes a debug panel showing:
- All plucked strings
- Pluck order
- Target chord requirements
- Current string status

## Code Style

### TypeScript Strictness

- Strict mode enabled in `tsconfig.json`
- Use non-null assertions (`!`) only when guaranteed safe
- Prefer optional chaining: `fretSet?.has(fret)` over `fretSet && fretSet.has(fret)`

### Vue Composition API

- Use `<script setup>` for all components
- Define interfaces before components
- Use `defineProps<Props>()` for type-safe props
- Prefer `computed()` over methods for derived state

### Naming Conventions

- Components: PascalCase (`FretBoard.vue`)
- Composables: camelCase starting with "use" (`useMidi.ts`)
- Refs: camelCase (`fretPositions`)
- Constants: UPPER_SNAKE_CASE (`AUTO_CLEAR_DELAY`)

## Future Enhancements

### Potential Features

1. **Rhythm Practice Mode**
   - Metronome integration
   - Strumming pattern validation
   - Timing accuracy tracking

2. **Song Mode**
   - Load chord progressions from song files
   - Lyrics display
   - Scroll with progress

3. **Tuning Detection**
   - Detect guitar tuning from Note ON messages
   - Support alternative tunings (Drop D, DADGAD, etc.)
   - Auto-adjust chord diagrams

4. **Multiplayer**
   - WebRTC for real-time practice with others
   - Shared progress tracking
   - Friendly competition

5. **Mobile Support**
   - Progressive Web App (PWA)
   - Touch-friendly UI
   - Audio input instead of MIDI (using Web Audio API)

### Architecture Improvements

1. **State Management**
   - Consider Pinia for complex state
   - Separate MIDI concerns from UI state

2. **Testing**
   - Unit tests with Vitest
   - Component tests with Vue Test Utils
   - E2E tests with Playwright

3. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - High contrast mode

---

## Quick Reference

### Important Files

- `src/composables/useMidi.ts` - MIDI handling singleton
- `src/components/PracticeMode.vue` - Chord practice logic
- `src/components/FretBoard.vue` - Fretboard visualization
- `src/data/chords.json` - Chord definitions
- `src/db/practiceDb.ts` - IndexedDB wrapper

### Common Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Useful Resources

- [Web MIDI API Spec](https://webaudio.github.io/web-midi-api/)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Dexie.js Docs](https://dexie.org/)
- [D3.js Gallery](https://observablehq.com/@d3/gallery)
