export interface ScalePosition {
  string: number // 1-6, 1 = high e, 6 = low E
  fret: number
}

export interface ScalePreset {
  id: string
  name: string
  description: string
  capo: number
  positions: ScalePosition[]
}

// C Major scale (C D E F G A B) mapped onto the 5 CAGED positions.
// Each position is a ~5-fret box built from the CAGED chord shape whose
// root note lands on C: C-shape root at fret 3 (A string), A-shape at
// fret 3 (A string, barred), G-shape at fret 8 (low E string), E-shape at
// fret 8 (low E string), D-shape at fret 10 (D string).
export const cagedCMajorPresets: ScalePreset[] = [
  {
    id: 'caged-c-major-c-shape',
    name: 'C Major - C Shape (Position 1)',
    description: 'Open position, frets 0-4. Root on the A string, 3rd fret.',
    capo: 0,
    positions: [
      { string: 6, fret: 0 }, { string: 6, fret: 1 }, { string: 6, fret: 3 },
      { string: 5, fret: 0 }, { string: 5, fret: 2 }, { string: 5, fret: 3 },
      { string: 4, fret: 0 }, { string: 4, fret: 2 }, { string: 4, fret: 3 },
      { string: 3, fret: 0 }, { string: 3, fret: 2 }, { string: 3, fret: 4 },
      { string: 2, fret: 0 }, { string: 2, fret: 1 }, { string: 2, fret: 3 },
      { string: 1, fret: 0 }, { string: 1, fret: 1 }, { string: 1, fret: 3 }
    ]
  },
  {
    id: 'caged-c-major-a-shape',
    name: 'C Major - A Shape (Position 2)',
    description: 'Frets 3-7. Root on the A string, 3rd fret (barred).',
    capo: 0,
    positions: [
      { string: 6, fret: 3 }, { string: 6, fret: 5 }, { string: 6, fret: 7 },
      { string: 5, fret: 3 }, { string: 5, fret: 5 }, { string: 5, fret: 7 },
      { string: 4, fret: 3 }, { string: 4, fret: 5 }, { string: 4, fret: 7 },
      { string: 3, fret: 4 }, { string: 3, fret: 5 }, { string: 3, fret: 7 },
      { string: 2, fret: 3 }, { string: 2, fret: 5 }, { string: 2, fret: 6 },
      { string: 1, fret: 3 }, { string: 1, fret: 5 }, { string: 1, fret: 7 }
    ]
  },
  {
    id: 'caged-c-major-g-shape',
    name: 'C Major - G Shape (Position 3)',
    description: 'Frets 5-9. Root on the low E string, 8th fret.',
    capo: 0,
    positions: [
      { string: 6, fret: 5 }, { string: 6, fret: 7 }, { string: 6, fret: 8 },
      { string: 5, fret: 5 }, { string: 5, fret: 7 }, { string: 5, fret: 8 },
      { string: 4, fret: 5 }, { string: 4, fret: 7 }, { string: 4, fret: 9 },
      { string: 3, fret: 5 }, { string: 3, fret: 7 }, { string: 3, fret: 9 },
      { string: 2, fret: 5 }, { string: 2, fret: 6 }, { string: 2, fret: 8 },
      { string: 1, fret: 5 }, { string: 1, fret: 7 }, { string: 1, fret: 8 }
    ]
  },
  {
    id: 'caged-c-major-e-shape',
    name: 'C Major - E Shape (Position 4)',
    description: 'Frets 8-12. Root on the low E string, 8th fret (barred).',
    capo: 0,
    positions: [
      { string: 6, fret: 8 }, { string: 6, fret: 10 }, { string: 6, fret: 12 },
      { string: 5, fret: 8 }, { string: 5, fret: 10 }, { string: 5, fret: 12 },
      { string: 4, fret: 9 }, { string: 4, fret: 10 }, { string: 4, fret: 12 },
      { string: 3, fret: 9 }, { string: 3, fret: 10 }, { string: 3, fret: 12 },
      { string: 2, fret: 8 }, { string: 2, fret: 10 }, { string: 2, fret: 12 },
      { string: 1, fret: 8 }, { string: 1, fret: 10 }, { string: 1, fret: 12 }
    ]
  },
  {
    id: 'caged-c-major-d-shape',
    name: 'C Major - D Shape (Position 5)',
    description: 'Frets 10-14. Root on the D string, 10th fret.',
    capo: 0,
    positions: [
      { string: 6, fret: 10 }, { string: 6, fret: 12 }, { string: 6, fret: 13 },
      { string: 5, fret: 10 }, { string: 5, fret: 12 }, { string: 5, fret: 14 },
      { string: 4, fret: 10 }, { string: 4, fret: 12 }, { string: 4, fret: 14 },
      { string: 3, fret: 10 }, { string: 3, fret: 12 }, { string: 3, fret: 14 },
      { string: 2, fret: 10 }, { string: 2, fret: 12 }, { string: 2, fret: 13 },
      { string: 1, fret: 10 }, { string: 1, fret: 12 }, { string: 1, fret: 13 }
    ]
  }
]
