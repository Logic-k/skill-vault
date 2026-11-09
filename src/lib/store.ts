import { useSyncExternalStore } from 'react'
import type { SavedSkill, Settings } from './types'

const KEY = 'skill-vault/v1'

interface State {
  version: 1
  skills: SavedSkill[]
  settings: Settings
  seeded: boolean
}

const DEFAULT: State = { version: 1, skills: [], settings: { token: '', customCategories: [] }, seeded: false }

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<State>
    return {
      version: 1,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      settings: { ...DEFAULT.settings, ...(parsed.settings ?? {}) },
      seeded: !!parsed.seeded,
    }
  } catch {
    return DEFAULT
  }
}

let state: State = load()
const listeners = new Set<() => void>()

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.error('저장 실패', e)
  }
  for (const l of listeners) l()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore() {
  return useSyncExternalStore(subscribe, () => state)
}

export const store = {
  get: () => state,
  upsertSkill(s: SavedSkill) {
    const i = state.skills.findIndex((x) => x.id === s.id)
    const skills = [...state.skills]
    if (i >= 0) skills[i] = { ...skills[i], ...s }
    else skills.unshift(s)
    state = { ...state, skills }
    emit()
  },
  addMany(items: SavedSkill[], markSeeded = false) {
    const map = new Map(state.skills.map((s) => [s.id, s]))
    let added = 0
    for (const s of items) {
      if (!map.has(s.id)) added++
      map.set(s.id, { ...map.get(s.id), ...s })
    }
    state = { ...state, skills: [...map.values()], seeded: state.seeded || markSeeded }
    emit()
    return added
  },
  updateSkill(id: string, patch: Partial<SavedSkill>) {
    state = { ...state, skills: state.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)) }
    emit()
  },
  removeSkill(id: string) {
    state = { ...state, skills: state.skills.filter((s) => s.id !== id) }
    emit()
  },
  setSettings(patch: Partial<Settings>) {
    state = { ...state, settings: { ...state.settings, ...patch } }
    emit()
  },
  markSeeded() {
    state = { ...state, seeded: true }
    emit()
  },
  exportJson(): string {
    const { token: _t, ...settings } = state.settings
    void _t
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), skills: state.skills, settings }, null, 2)
  },
  importJson(text: string, mode: 'merge' | 'replace') {
    const parsed = JSON.parse(text) as Partial<State>
    const incoming = Array.isArray(parsed.skills) ? parsed.skills : []
    let skills: SavedSkill[]
    if (mode === 'replace') skills = incoming
    else {
      const map = new Map(state.skills.map((s) => [s.id, s]))
      for (const s of incoming) map.set(s.id, s)
      skills = [...map.values()].sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    }
    const customCategories = parsed.settings?.customCategories ?? state.settings.customCategories
    state = { ...state, skills, settings: { ...state.settings, customCategories }, seeded: true }
    emit()
    return incoming.length
  },
}

export function skillId(owner: string, repo: string, path: string) {
  return `${owner}/${repo}${path ? '/' + path : ''}`.toLowerCase()
}
