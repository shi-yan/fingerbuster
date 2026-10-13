import { ref } from 'vue'
import { guitarEngine, type PluckOptions, type StrumOptions, type StringFret } from '../audio/guitarEngine'
import { getNoteLabel } from '../utils/noteNames'

// Module-level so every component sees the same loading state for the shared engine
const isLoaded = ref(false)
const isLoading = ref(false)

/**
 * Vue wrapper around the shared GuitarEngine (see src/audio/guitarEngine.ts).
 * The engine itself holds no reactive state, so it never needs markRaw().
 */
export function useGuitarSampler() {
  /**
   * Starts audio and loads samples. Must be called from a user gesture
   * (click/keypress) the first time, per browser autoplay rules.
   */
  async function ensureReady(): Promise<void> {
    if (!guitarEngine.isLoaded) isLoading.value = true
    try {
      await guitarEngine.ensureReady()
      isLoaded.value = true
    } finally {
      isLoading.value = false
    }
  }

  function playString(guitarString: number, fret: number, options?: PluckOptions): void {
    guitarEngine.pluck(guitarString, fret, options)
  }

  function playChord(stringFrets: StringFret[], options?: StrumOptions): void {
    guitarEngine.strum(stringFrets, options)
  }

  return {
    isLoaded,
    isLoading,
    ensureReady,
    playString,
    playChord,
    releaseString: (guitarString: number, when?: number) => guitarEngine.release(guitarString, when),
    muteString: (guitarString: number, when?: number) => guitarEngine.mute(guitarString, when),
    stopAll: () => guitarEngine.stopAll(),
    currentTime: () => guitarEngine.currentTime,
    getNoteForStringAndFret: getNoteLabel
  }
}
