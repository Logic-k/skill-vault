import { useMemo } from 'react'
import { siteTypeLabel } from '../data/siteTypes'
import { categoryLabel } from '../lib/categorize'
import { KIND_LABEL, type CategoryRule, type SavedSkill } from '../lib/types'

/** Deterministic small integer from a string, for stable spine heights / tints. */
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h >>> 0)
}

/** Hue per category so shelves read as colour families. */
const CAT_HUE: Record<string, number> = {
  design: 330,
  dev: 215,
  'ai-agent': 262,
  'docs-writing': 38,
  data: 180,
  productivity: 95,
  devops: 200,
  security: 0,
  'browser-automation': 150,
  marketing: 20,
  media: 300,
  education: 55,
  etc: 230,
}

function hueFor(cat: string) {
  return CAT_HUE[cat] ?? hash(cat) % 360
}

export function Spine({ skill, rules, onOpen }: { skill: SavedSkill; rules: CategoryRule[]; onOpen: () => void }) {
  const cats = skill.manualCategories ?? skill.categories
  const h = hash(skill.id)
  const hue = hueFor(cats[0] ?? 'etc')
  const sat = 38 + (h % 18)
  const light = 30 + ((h >> 4) % 18)
  const height = 168 + ((h >> 8) % 44)
  const width = skill.kind === 'website' ? 38 : 42 + ((h >> 12) % 14)
  const isWeb = skill.kind === 'website'
  const style = {
    '--spine': `hsl(${hue} ${sat}% ${light}%)`,
    '--spine-dark': `hsl(${hue} ${sat}% ${Math.max(light - 14, 10)}%)`,
    '--spine-light': `hsl(${hue} ${sat - 10}% ${Math.min(light + 22, 85)}%)`,
    height,
    width,
  } as React.CSSProperties
  const sub = isWeb ? siteTypeLabel(skill.web?.siteType ?? 'other').label : KIND_LABEL[skill.kind]
  return (
    <button
      className={`spine ${isWeb ? 'spine-web' : 'spine-book'} ${skill.status === 'archived' ? 'spine-archived' : ''} ${skill.status === 'using' ? 'spine-using' : ''}`}
      style={style}
      onClick={onOpen}
      title={`${skill.name}\n${sub} · ${cats.map((c) => categoryLabel(c, rules)).join(', ')}\n${skill.description.slice(0, 140)}`}
    >
      {isWeb ? (
        <img className="spine-favicon" src={skill.web?.favicon} alt="" loading="lazy" />
      ) : (
        <span className="spine-band" />
      )}
      <span className="spine-title">{skill.name}</span>
      {!isWeb && <span className="spine-foot">{skill.meta.stars > 0 ? `★${skill.meta.stars >= 1000 ? Math.round(skill.meta.stars / 1000) + 'k' : skill.meta.stars}` : ''}</span>}
    </button>
  )
}

export function Bookshelf({
  skills,
  rules,
  groupBy,
  onOpen,
}: {
  skills: SavedSkill[]
  rules: CategoryRule[]
  groupBy: 'category' | 'kind' | 'siteType'
  onOpen: (id: string) => void
}) {
  const shelves = useMemo(() => {
    const map = new Map<string, { label: string; icon?: string; items: SavedSkill[] }>()
    const order: string[] = []
    const push = (key: string, label: string, s: SavedSkill, icon?: string) => {
      if (!map.has(key)) {
        map.set(key, { label, icon, items: [] })
        order.push(key)
      }
      map.get(key)!.items.push(s)
    }
    for (const s of skills) {
      if (groupBy === 'category') {
        const c = (s.manualCategories ?? s.categories)[0] ?? 'etc'
        push(c, categoryLabel(c, rules), s)
      } else if (groupBy === 'kind') {
        push(s.kind, KIND_LABEL[s.kind], s)
      } else {
        if (s.kind === 'website') {
          const t = siteTypeLabel(s.web?.siteType ?? 'other')
          push(t.id, t.label, s, t.icon)
        } else push('github', 'GitHub 저장소', s, '🐙')
      }
    }
    if (groupBy === 'category') {
      const rank = new Map([...rules.map((r) => r.id), 'etc'].map((id, i) => [id, i]))
      order.sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99))
    } else order.sort((a, b) => map.get(b)!.items.length - map.get(a)!.items.length)
    for (const v of map.values()) v.items.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    return order.map((k) => ({ key: k, ...map.get(k)! }))
  }, [skills, rules, groupBy])

  if (!skills.length) return null
  return (
    <div className="bookcase">
      {shelves.map((sh) => (
        <section key={sh.key} className="shelf">
          <div className="shelf-plaque">
            {sh.icon && <span>{sh.icon} </span>}
            {sh.label} <small>{sh.items.length}</small>
          </div>
          <div className="shelf-row">
            {sh.items.map((s) => (
              <Spine key={s.id} skill={s} rules={rules} onOpen={() => onOpen(s.id)} />
            ))}
          </div>
          <div className="shelf-board" />
        </section>
      ))}
    </div>
  )
}
