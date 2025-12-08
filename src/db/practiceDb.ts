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
}

export interface DailyPluckingProgress {
  dateId: string // format: YYYY-MM-DD (e.g., "2025-11-28")
  plucks: StringPluck[]
}

export class PracticeDatabase extends Dexie {
  dailyProgress!: Table<DailyProgress>
  dailyPluckingProgress!: Table<DailyPluckingProgress>

  constructor() {
    super('PracticeDatabase')
    this.version(1).stores({
      dailyProgress: 'dateId'
    })
    this.version(2).stores({
      dailyProgress: 'dateId',
      dailyPluckingProgress: 'dateId'
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
export async function addStringPluck(string: number, time: number) {
  const dateId = getTodayDateId()

  // Get existing progress for today
  const existing = await db.dailyPluckingProgress.get(dateId)

  if (existing) {
    // Append to existing plucks
    existing.plucks.push({ string, time })
    await db.dailyPluckingProgress.put(existing)
  } else {
    // Create new entry for today
    await db.dailyPluckingProgress.add({
      dateId,
      plucks: [{ string, time }]
    })
  }
}

// Helper function to get all plucking progress
export async function getAllPluckingProgress(): Promise<DailyPluckingProgress[]> {
  return await db.dailyPluckingProgress.toArray()
}
