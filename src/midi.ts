import { useMidi } from './composables/useMidi'

// Create a singleton MIDI instance that's shared across the entire app
export const sharedMidi = useMidi()
