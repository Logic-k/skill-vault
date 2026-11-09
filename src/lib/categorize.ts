import { BUILTIN_CATEGORIES, FALLBACK_CATEGORY } from '../data/categories'
import type { CategoryRule, RepoMeta, SkillAnalysis } from './types'

export function allCategories(custom: CategoryRule[]): CategoryRule[] {
  const map = new Map<string, CategoryRule>()
  for (const c of BUILTIN_CATEGORIES) map.set(c.id, c)
  for (const c of custom) {
    const prev = map.get(c.id)
    map.set(c.id, prev ? { ...prev, label: c.label || prev.label, keywords: [...prev.keywords, ...c.keywords] } : c)
  }
  return [...map.values()]
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type Scorable = Pick<SkillAnalysis, 'name' | 'description' | 'tags' | 'entryFiles' | 'dependencies'> & {
  skillMd?: string
  readme?: string
  note?: string
}

/**
 * Score each category by weighted keyword hits. Name/tags/topics count more than README prose.
 * Returns up to `max` category ids, falling back to '기타'.
 */
export function categorize(a: Scorable, meta: Pick<RepoMeta, 'topics' | 'description'>, rules: CategoryRule[], max = 2): string[] {
  const fields = [
    { text: a.name, weight: 4 },
    { text: [...a.tags, ...meta.topics].join(' '), weight: 4 },
    { text: a.description, weight: 3 },
    { text: meta.description ?? '', weight: 3 },
    { text: a.note ?? '', weight: 1.5 },
    { text: a.entryFiles.join(' ').replace(/[/_.-]/g, ' '), weight: 1.5 },
    { text: (a.skillMd ?? a.readme ?? '').slice(0, 4000), weight: 1 },
    { text: a.dependencies.map((d) => d.name).join(' '), weight: 1 },
  ].map((f) => ({ ...f, text: f.text.toLowerCase() }))

  const scores = new Map<string, number>()
  for (const rule of rules) {
    let score = 0
    for (const kw of rule.keywords) {
      const k = kw.toLowerCase()
      const re = /^[a-z0-9 .+/-]+$/.test(k) ? new RegExp(`(^|[^a-z0-9])${escapeRe(k)}([^a-z0-9]|$)`, 'g') : new RegExp(escapeRe(k), 'g')
      for (const f of fields) {
        const hits = f.text.match(re)?.length ?? 0
        if (hits) score += f.weight * Math.min(hits, 3)
      }
    }
    if (score > 0) scores.set(rule.id, score)
  }
  const ranked = [...scores.entries()].sort((x, y) => y[1] - x[1])
  if (!ranked.length) return [FALLBACK_CATEGORY.id]
  const top = ranked[0][1]
  return ranked
    .filter(([, s], i) => i === 0 || s >= top * 0.55)
    .slice(0, max)
    .map(([id]) => id)
}

export function categoryLabel(id: string, rules: CategoryRule[]) {
  return rules.find((r) => r.id === id)?.label ?? (id === FALLBACK_CATEGORY.id ? FALLBACK_CATEGORY.label : id)
}
