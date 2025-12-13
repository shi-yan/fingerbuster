import Dexie, { type Table } from 'dexie'

export interface ChordTransition {
  chord: string
  time: number // in seconds
}

export interface DailyProgress {
  dateId: string // format: YYYY-MM-DD (e.g., "2025-11-28")
  transitions: ChordTransition[]
}

export interface StringPluck {
  string: number // 1-6 (guitar string number)
  time: number // in seconds
  attempts?: number // Number of attempts to pluck correctly (1 = first try, 2+ = retries)
}

export interface DailyPluckingProgress {
  dateId: string // format: YYYY-MM-DD (e.g., "2025-11-28")
  plucks: StringPluck[]
}

export interface SavedProgression {
  id?: number // Auto-incremented ID
  name: string // User-defined name
  chords: string[] // Array of chord names
  createdAt: number // Timestamp
}

export class PracticeDatabase extends Dexie {
  dailyProgress!: Table<DailyProgress>
  dailyPluckingProgress!: Table<DailyPluckingProgress>
  savedProgressions!: Table<SavedProgression>

  constructor() {
    super('PracticeDatabase')
    this.version(1).stores({
      dailyProgress: 'dateId'
    })
    this.version(2).stores({
      dailyProgress: 'dateId',
      dailyPluckingProgress: 'dateId'
    })
    this.version(3).stores({
      dailyProgress: 'dateId',
      dailyPluckingProgress: 'dateId',
      savedProgressions: '++id, name'
    })
  }
}

export const db = new PracticeDatabase()

// Helper function to get today's date ID
export function getTodayDateId(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper function to add a chord transition
export async function addChordTransition(chord: string, time: number) {
  const dateId = getTodayDateId()

  // Get existing progress for today
  const existing = await db.dailyProgress.get(dateId)

  if (existing) {
    // Append to existing transitions
    existing.transitions.push({ chord, time })
    await db.dailyProgress.put(existing)
  } else {
    // Create new entry for today
    await db.dailyProgress.add({
      dateId,
      transitions: [{ chord, time }]
    })
  }
}

// Helper function to get progress for a date range
export async function getProgressRange(startDate: string, endDate: string): Promise<DailyProgress[]> {
  return await db.dailyProgress
    .where('dateId')
    .between(startDate, endDate, true, true)
    .toArray()
}

// Helper function to get all progress
export async function getAllProgress(): Promise<DailyProgress[]> {
  return await db.dailyProgress.toArray()
}

// Helper function to add a string pluck
export async function addStringPluck(string: number, time: number, attempts: number = 1) {
  const dateId = getTodayDateId()

  // Get existing progress for today
  const existing = await db.dailyPluckingProgress.get(dateId)

  if (existing) {
    // Append to existing plucks
    existing.plucks.push({ string, time, attempts })
    await db.dailyPluckingProgress.put(existing)
  } else {
    // Create new entry for today
    await db.dailyPluckingProgress.add({
      dateId,
      plucks: [{ string, time, attempts }]
    })
  }
}

// Helper function to get all plucking progress
export async function getAllPluckingProgress(): Promise<DailyPluckingProgress[]> {
  return await db.dailyPluckingProgress.toArray()
}

// Helper function to save a custom chord progression
export async function saveProgression(name: string, chords: string[]): Promise<number> {
  const existing = await db.savedProgressions.where('name').equals(name).first()

  if (existing) {
    // Update existing progression
    await db.savedProgressions.update(existing.id!, {
      chords,
      createdAt: Date.now()
    })
    return existing.id!
  } else {
    // Create new progression
    return await db.savedProgressions.add({
      name,
      chords,
      createdAt: Date.now()
    })
  }
}

// Helper function to get all saved progressions
export async function getAllSavedProgressions(): Promise<SavedProgression[]> {
  return await db.savedProgressions.toArray()
}

// Helper function to delete a saved progression
export async function deleteProgression(id: number): Promise<void> {
  await db.savedProgressions.delete(id)
}
