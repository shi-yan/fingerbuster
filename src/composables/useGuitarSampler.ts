import { ref, markRaw } from 'vue'
// DON'T import Tone here - it will load immediately and create AudioContext
// We'll dynamically import it only when needed

/**
 * IMPORTANT: Vue.js + Tone.js Integration Gotchas
 *
 * 1. NEVER import Tone.js at module level
 *    ❌ import * as Tone from 'tone'  // Creates AudioContext on page load!
 *    ✅ Use dynamic import: const Tone = await import('tone')
 *
 *    Reason: Browsers require AudioContext to be created from a user gesture.
 *    Static imports happen before any user interaction, violating this policy.
 *
 * 2. ALWAYS use markRaw() for Tone.js objects
 *    ❌ sampler.value = new Tone.Sampler(...)  // Vue wraps in Proxy!
 *    ✅ sampler.value = markRaw(new Tone.Sampler(...))
 *
 *    Reason: Vue's reactivity wraps objects in a Proxy, which changes object identity.
 *    Tone.js uses standardized-audio-context which checks object identity internally.
 *    When wrapped in Proxy, these identity checks fail, causing InvalidStateError.
 *
 *    Example error without markRaw():
 *    "Uncaught InvalidStateError at get-native-context.js:6"
 *    "GainNode @ gain-node-constructor.js:11"
 *
 *    Reference: https://stackoverflow.com/questions/67253992/
 *
 * 3. Initialization order matters
 *    ✅ Correct order:
 *       1. User clicks button (user gesture)
 *       2. Dynamic import Tone.js
 *       3. Start AudioContext with Tone.start()
 *       4. Create Sampler with markRaw()
 *       5. Play notes
 */

// Guitar string tuning in standard tuning (string number -> base note)
const GUITAR_TUNING: Record<number, string> = {
  1: 'E4', // High E
  2: 'B3',
  3: 'G3',
  4: 'D3',
  5: 'A2',
  6: 'E2'  // Low E
}

// Note names for calculating fret positions
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function useGuitarSampler() {
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const sampler = ref<any | null>(null)  // Type as 'any' since Tone.Sampler isn't imported yet
  let Tone: any = null  // Will be loaded dynamically

  /**
   * Calculate the note name for a given string and fret
   */
  function getNoteForStringAndFret(guitarString: number, fret: number): string {
    const baseNote = GUITAR_TUNING[guitarString]
    if (!baseNote) {
      console.error(`Invalid guitar string: ${guitarString}`)
      return 'C4'
    }

    // Parse base note (e.g., "E4" -> note: "E", octave: 4)
    const noteMatch = baseNote.match(/([A-G]#?)(\d)/)
    if (!noteMatch) {
      console.error(`Invalid base note format: ${baseNote}`)
      return 'C4'
    }

    const noteName = noteMatch[1]!
    const octaveStr = noteMatch[2]!
    let octave = parseInt(octaveStr)

    // Find the index of the base note
    const baseIndex = NOTE_NAMES.indexOf(noteName)
    if (baseIndex === -1) {
      console.error(`Invalid note name: ${noteName}`)
      return 'C4'
    }

    // Add frets to get target note
    let targetIndex = baseIndex + fret

    // Handle octave wrapping
    while (targetIndex >= NOTE_NAMES.length) {
      targetIndex -= NOTE_NAMES.length
      octave++
    }

    const targetNote = NOTE_NAMES[targetIndex]
    return `${targetNote}${octave}`
  }

  /**
   * Initialize the guitar sampler with acoustic guitar samples from tonejs-instruments
   */
  async function initializeSampler(): Promise<void> {
    if (isLoaded.value || isLoading.value) {
      return
    }

    isLoading.value = true

    try {
      // Dynamically import Tone.js ONLY when needed (on first play)
      if (!Tone) {
        console.log('📦 Dynamically importing Tone.js...')
        const ToneModule = await import('tone')
        Tone = ToneModule
        console.log('✅ Tone.js imported')
      }

      // URL for tonejs-instruments guitar samples
      const baseUrl = 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/'

      // Create a sampler with guitar samples - return a Promise
      // Use markRaw() to prevent Vue from making the Sampler reactive
      // This fixes InvalidStateError caused by Vue's Proxy wrapping
      await new Promise<void>((resolve, reject) => {
        const newSampler = new Tone.Sampler(
          {
            A2: 'A2.mp3',
            A3: 'A3.mp3',
            A4: 'A4.mp3',
            'C3': 'C3.mp3',
            'C4': 'C4.mp3',
            'C5': 'C5.mp3',
            'D#2': 'Ds2.mp3',
            'D#3': 'Ds3.mp3',
            'D#4': 'Ds4.mp3',
            'F#2': 'Fs2.mp3',
            'F#3': 'Fs3.mp3',
            'F#4': 'Fs4.mp3'
          },
          {
            baseUrl,
            onload: () => {
              isLoaded.value = true
              isLoading.value = false
              console.log('✅ Guitar sampler loaded successfully')
              resolve()
            },
            onerror: (error: Error) => {
              console.error('❌ Error loading guitar samples:', error)
              isLoading.value = false
              reject(error)
            }
          }
        ).toDestination()

        // Wrap with markRaw to prevent Vue reactivity
        sampler.value = markRaw(newSampler)
      })

    } catch (error) {
      console.error('❌ Error initializing sampler:', error)
      isLoading.value = false
      throw error
    }
  }

  /**
   * Play a note for a specific guitar string and fret
   */
  function playString(guitarString: number, fret: number, duration: string = '8n'): void {
    if (!sampler.value || !isLoaded.value) {
      console.warn('Sampler not loaded yet')
      return
    }

    const note = getNoteForStringAndFret(guitarString, fret)
    console.log(`Playing string ${guitarString} at fret ${fret}: ${note}`)

    try {
      sampler.value.triggerAttackRelease(note, duration)
    } catch (error) {
      console.error('Error playing note:', error)
    }
  }

  /**
   * Play a chord (multiple strings with their fret positions)
   */
  function playChord(
    stringFrets: Array<{ string: number; fret: number }>,
    duration: string = '2n'
  ): void {
    if (!sampler.value || !isLoaded.value) {
      console.warn('Sampler not loaded yet')
      return
    }

    const notes = stringFrets.map(({ string, fret }) =>
      getNoteForStringAndFret(string, fret)
    )

    console.log('Playing chord:', notes)

    try {
      sampler.value.triggerAttackRelease(notes, duration)
    } catch (error) {
      console.error('Error playing chord:', error)
    }
  }

  /**
   * Start audio context (required for user interaction)
   */
  async function startAudio(): Promise<void> {
    // Dynamically import Tone.js if not already loaded
    if (!Tone) {
      console.log('📦 Dynamically importing Tone.js for audio context...')
      const ToneModule = await import('tone')
      Tone = ToneModule
      console.log('✅ Tone.js imported')
    }

    if (Tone.context.state !== 'running') {
      console.log('▶️ Starting AudioContext...')
      await Tone.start()
      console.log('✅ AudioContext started, state:', Tone.context.state)
    } else {
      console.log('ℹ️ AudioContext already running')
    }
  }

  /**
   * Stop all currently playing notes
   */
  function stopAll(): void {
    if (sampler.value) {
      sampler.value.releaseAll()
    }
  }

  return {
    isLoaded,
    isLoading,
    sampler,
    initializeSampler,
    playString,
    playChord,
    startAudio,
    stopAll,
    getNoteForStringAndFret
  }
}
