import type { SkillKind } from './types'

/** Muted cloth-binding colours, one per category. Shared by book covers, the distribution bar, chips and the index. */
const CAT_HSL: Record<string, [number, number, number]> = {
  design: [338, 32, 38],
  dev: [218, 36, 34],
  'ai-agent': [160, 30, 29],
  'docs-writing': [38, 52, 38],
  data: [190, 40, 30],
  productivity: [84, 26, 34],
  devops: [208, 16, 38],
  security: [356, 44, 33],
  'browser-automation': [22, 50, 39],
  marketing: [12, 52, 42],
  media: [282, 24, 37],
  education: [48, 42, 35],
  etc: [30, 8, 38],
}

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h >>> 0)
}

export function catHsl(id: string): [number, number, number] {
  return CAT_HSL[id] ?? [hash(id) % 360, 28, 36]
}

export function catColor(id: string, lightShift = 0) {
  const [h, s, l] = catHsl(id)
  return `hsl(${h} ${s}% ${Math.max(8, Math.min(92, l + lightShift))}%)`
}

/** Short type tag shown in dense lists instead of a long label. */
export const KIND_TAG: Record<SkillKind, string> = {
  'claude-skill': '스킬',
  'skill-collection': '스킬+',
  'claude-plugin': '플러그인',
  'claude-marketplace': '마켓',
  'mcp-server': 'MCP',
  'npm-package': 'npm',
  'python-package': 'py',
  repo: 'repo',
  website: 'web',
}
