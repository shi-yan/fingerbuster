import type { StrumPattern } from '../types/strumming'

// All 6 strings for full strums
const ALL_STRINGS = [1, 2, 3, 4, 5, 6]

// Top 4 strings for lighter strums
const TOP_4_STRINGS = [1, 2, 3, 4]

export const STRUMMING_PATTERNS: StrumPattern[] = [
  {
    id: 'basic-down',
    name: 'Basic Downstrokes',
    description: 'Four downstrokes per bar - the simplest pattern',
    difficulty: 'beginner',
    timeSignature: { beats: 4, noteValue: 4 },
    bars: 1,
    strums: [
      { beat: 0, subdivision: 0, direction: 'down', strings: ALL_STRINGS, emphasis: true },
      { beat: 1, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 2, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 3, subdivision: 0, direction: 'down', strings: ALL_STRINGS }
    ],
    recommendedBPM: { min: 60, max: 100 }
  },

  {
    id: 'down-up-simple',
    name: 'Simple Down-Up',
    description: 'Down on the beat, up on the offbeat (eighth notes)',
    difficulty: 'beginner',
    timeSignature: { beats: 4, noteValue: 4 },
    bars: 1,
    strums: [
      { beat: 0, subdivision: 0, direction: 'down', strings: ALL_STRINGS, emphasis: true },
      { beat: 0, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS },
      { beat: 1, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 1, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS },
      { beat: 2, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 2, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS },
      { beat: 3, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 3, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS }
    ],
    recommendedBPM: { min: 50, max: 90 }
  },

  {
    id: 'old-faithful',
    name: 'Old Faithful (D-DU-UDU)',
    description: 'Classic country/folk pattern: Down, Down-Up, Up-Down-Up',
    difficulty: 'intermediate',
    timeSignature: { beats: 4, noteValue: 4 },
    bars: 1,
    strums: [
      { beat: 0, subdivision: 0, direction: 'down', strings: ALL_STRINGS, emphasis: true }, // 1
      { beat: 1, subdivision: 0, direction: 'down', strings: ALL_STRINGS },                 // 2
      { beat: 1, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS },               // &
      { beat: 2, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS },               // &
      { beat: 3, subdivision: 0, direction: 'down', strings: ALL_STRINGS },                 // 4
      { beat: 3, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS }                // &
    ],
    recommendedBPM: { min: 60, max: 110 }
  },

  {
    id: 'common-time',
    name: 'Common Time',
    description: 'Down on 1,2,3,4 and up on all the "ands"',
    difficulty: 'beginner',
    timeSignature: { beats: 4, noteValue: 4 },
    bars: 1,
    strums: [
      { beat: 0, subdivision: 0, direction: 'down', strings: ALL_STRINGS, emphasis: true },
      { beat: 0, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS },
      { beat: 1, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 1, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS },
      { beat: 2, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 2, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS },
      { beat: 3, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 3, subdivision: 0.5, direction: 'up', strings: TOP_4_STRINGS }
    ],
    recommendedBPM: { min: 60, max: 120 }
  },

  {
    id: 'bass-strum',
    name: 'Bass-Strum Pattern',
    description: 'Alternating bass notes and strums (fingerstyle transition)',
    difficulty: 'intermediate',
    timeSignature: { beats: 4, noteValue: 4 },
    bars: 1,
    strums: [
      { beat: 0, subdivision: 0, direction: 'down', strings: [6], emphasis: true },        // Bass
      { beat: 0, subdivision: 0.5, direction: 'down', strings: [1, 2, 3, 4] },            // Strum
      { beat: 1, subdivision: 0, direction: 'down', strings: [5] },                        // Alt bass
      { beat: 1, subdivision: 0.5, direction: 'down', strings: [1, 2, 3, 4] },            // Strum
      { beat: 2, subdivision: 0, direction: 'down', strings: [6] },                        // Bass
      { beat: 2, subdivision: 0.5, direction: 'down', strings: [1, 2, 3, 4] },            // Strum
      { beat: 3, subdivision: 0, direction: 'down', strings: [5] },                        // Alt bass
      { beat: 3, subdivision: 0.5, direction: 'down', strings: [1, 2, 3, 4] }             // Strum
    ],
    recommendedBPM: { min: 50, max: 90 }
  },

  {
    id: 'reggae-skank',
    name: 'Reggae Skank',
    description: 'Upstrokes on the offbeat - classic reggae feel',
    difficulty: 'intermediate',
    timeSignature: { beats: 4, noteValue: 4 },
    bars: 1,
    strums: [
      { beat: 0, subdivision: 0.5, direction: 'up', strings: [2, 3, 4], emphasis: true },
      { beat: 1, subdivision: 0.5, direction: 'up', strings: [2, 3, 4] },
      { beat: 2, subdivision: 0.5, direction: 'up', strings: [2, 3, 4] },
      { beat: 3, subdivision: 0.5, direction: 'up', strings: [2, 3, 4] }
    ],
    recommendedBPM: { min: 70, max: 110 }
  },

  {
    id: 'boom-chicka',
    name: 'Boom-Chicka',
    description: 'Country/Johnny Cash pattern with bass emphasis',
    difficulty: 'intermediate',
    timeSignature: { beats: 4, noteValue: 4 },
    bars: 1,
    strums: [
      { beat: 0, subdivision: 0, direction: 'down', strings: [4, 5, 6], emphasis: true },  // BOOM
      { beat: 0, subdivision: 0.5, direction: 'down', strings: [1, 2, 3] },                // chicka
      { beat: 1, subdivision: 0, direction: 'down', strings: [4, 5, 6] },                  // BOOM
      { beat: 1, subdivision: 0.5, direction: 'down', strings: [1, 2, 3] },                // chicka
      { beat: 2, subdivision: 0, direction: 'down', strings: [4, 5, 6] },                  // BOOM
      { beat: 2, subdivision: 0.5, direction: 'down', strings: [1, 2, 3] },                // chicka
      { beat: 3, subdivision: 0, direction: 'down', strings: [4, 5, 6] },                  // BOOM
      { beat: 3, subdivision: 0.5, direction: 'down', strings: [1, 2, 3] }                 // chicka
    ],
    recommendedBPM: { min: 80, max: 140 }
  },

  {
    id: 'sixteenth-note',
    name: '16th Note Pattern',
    description: 'Fast down-up pattern with all sixteenth notes',
    difficulty: 'advanced',
    timeSignature: { beats: 4, noteValue: 4 },
    bars: 1,
    strums: [
      // Beat 1
      { beat: 0, subdivision: 0, direction: 'down', strings: ALL_STRINGS, emphasis: true },
      { beat: 0, subdivision: 0.25, direction: 'up', strings: TOP_4_STRINGS },
      { beat: 0, subdivision: 0.5, direction: 'down', strings: ALL_STRINGS },
      { beat: 0, subdivision: 0.75, direction: 'up', strings: TOP_4_STRINGS },
      // Beat 2
      { beat: 1, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 1, subdivision: 0.25, direction: 'up', strings: TOP_4_STRINGS },
      { beat: 1, subdivision: 0.5, direction: 'down', strings: ALL_STRINGS },
      { beat: 1, subdivision: 0.75, direction: 'up', strings: TOP_4_STRINGS },
      // Beat 3
      { beat: 2, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 2, subdivision: 0.25, direction: 'up', strings: TOP_4_STRINGS },
      { beat: 2, subdivision: 0.5, direction: 'down', strings: ALL_STRINGS },
      { beat: 2, subdivision: 0.75, direction: 'up', strings: TOP_4_STRINGS },
      // Beat 4
      { beat: 3, subdivision: 0, direction: 'down', strings: ALL_STRINGS },
      { beat: 3, subdivision: 0.25, direction: 'up', strings: TOP_4_STRINGS },
      { beat: 3, subdivision: 0.5, direction: 'down', strings: ALL_STRINGS },
      { beat: 3, subdivision: 0.75, direction: 'up', strings: TOP_4_STRINGS }
    ],
    recommendedBPM: { min: 40, max: 80 }
  }
]

// Helper function to get patterns by difficulty
export function getPatternsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): StrumPattern[] {
  return STRUMMING_PATTERNS.filter(p => p.difficulty === difficulty)
}

// Helper function to get pattern by ID
export function getPatternById(id: string): StrumPattern | undefined {
  return STRUMMING_PATTERNS.find(p => p.id === id)
}
