// Chromatic note names using sharps (standard convention for fretted instruments)
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// MIDI note number of the open string in standard tuning (EADGBE)
// String 1 = high e, String 6 = low E
export const OPEN_STRING_MIDI: Record<number, number> = {
  1: 64, // E4
  2: 59, // B3
  3: 55, // G3
  4: 50, // D3
  5: 45, // A2
  6: 40  // E2
}

/**
 * A capo shifts the effective "open" pitch of every fretted note up by its
 * fret count, since the fretted position closest to the bridge determines
 * the vibrating length. For a scale/practice editor, frets are entered
 * relative to the capo, so capo semitones are simply added to the note.
 */
export function getMidiNote(stringNumber: number, fret: number, capo: number = 0): number {
  const open = OPEN_STRING_MIDI[stringNumber]
  if (open === undefined) return 0
  return open + fret + capo
}

export function getNoteName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

export function getNoteLabel(stringNumber: number, fret: number, capo: number = 0): string {
  return getNoteName(getMidiNote(stringNumber, fret, capo))
}
