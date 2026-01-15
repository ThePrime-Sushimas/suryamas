import { useEffect } from 'react'
import type { JournalLine } from '../../shared/journal.types'

interface JournalDraft {
  journalDate: string
  description: string
  lines: JournalLine[]
  savedAt: string
}

const DRAFT_KEY = 'journal-entry-draft'

export function useAutoSaveDraft(
  journalDate: string,
  description: string,
  lines: JournalLine[],
  isEditing: boolean
) {
  useEffect(() => {
    if (isEditing) return

    const timer = setTimeout(() => {
      const draft: JournalDraft = {
        journalDate,
        description,
        lines,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    }, 2000)

    return () => clearTimeout(timer)
  }, [journalDate, description, lines, isEditing])
}

export function loadDraft(): JournalDraft | null {
  try {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (!saved) return null
    
    const draft = JSON.parse(saved) as JournalDraft
    
    const savedTime = new Date(draft.savedAt).getTime()
    const now = new Date().getTime()
    const hoursDiff = (now - savedTime) / (1000 * 60 * 60)
    
    if (hoursDiff > 24) {
      clearDraft()
      return null
    }
    
    return draft
  } catch {
    return null
  }
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}
