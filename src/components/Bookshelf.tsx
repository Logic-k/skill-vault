import { useMemo } from 'react'
import { siteTypeLabel } from '../data/siteTypes'
import { categoryLabel } from '../lib/categorize'
import { catHsl, hash, KIND_TAG } from '../lib/palette'
import { KIND_LABEL, type CategoryRule, type SavedSkill } from '../lib/types'

export type GroupBy = 'category' | 'kind' | 'siteType'

export interface Group {
  key: string
  label: string
  icon?: string
  /** category id when grouped by category, used for colour */
  cat?: string
  items: SavedSkill[]
}

/** Shared grouping for the shelf and the index. */
export function groupSkills(skills: SavedSkill[], rules: CategoryRule[], groupBy: GroupBy): Group[] {
  const map = new Map<string, Group>()
  const order: string[] = []
  const push = (key: string, label: string, s: SavedSkill, extra: Partial<Group> = {}) => {
    if (!map.has(key)) {
      map.set(key, { key, label, items: [], ...extra })
      order.push(key)
    }
    map.get(key)!.items.push(s)
  }
  for (const s of skills) {
    if (groupBy === 'category') {
      const c = (s.manualCategories ?? s.categories)[0] ?? 'etc'
      push(c, categoryLabel(c, rules), s, { cat: c })
    } else if (groupBy === 'kind') {
      push(s.kind, KIND_LABEL[s.kind], s)
    } else if (s.kind === 'website') {
      const t = siteTypeLabel(s.web?.siteType ?? 'other')
      push(t.id, t.label, s, { icon: t.icon })
    } else push('github', 'GitHub 저장소', s)
  }
  if (groupBy === 'category') {
    const rank = new Map([...rules.map((r) => r.id), 'etc'].map((id, i) => [id, i]))
    order.sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99))
  } else order.sort((a, b) => map.get(b)!.items.length - map.get(a)!.items.length)
  for (const v of map.values()) v.items.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return order.map((k) => map.get(k)!)
}

export function starText(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n)
}

export function Cover({ skill, rules, onOpen }: { skill: SavedSkill; rules: CategoryRule[]; onOpen: () => void }) {
  const cats = skill.manualCategories ?? skill.categories
  const h = hash(skill.id)
  const [hue, sat, light] = catHsl(cats[0] ?? 'etc')
  const l = light - 4 + (h % 9)
  const isWeb = skill.kind === 'website'
  const style = {
    '--cover': `hsl(${hue} ${sat}% ${l}%)`,
    '--cover-dark': `hsl(${hue} ${sat}% ${Math.max(l - 12, 8)}%)`,
    '--cover-light': `hsl(${hue} ${Math.max(sat - 8, 6)}% ${Math.min(l + 30, 90)}%)`,
    height: 138 + ((h >> 8) % 20),
  } as React.CSSProperties
  const sub = isWeb ? siteTypeLabel(skill.web?.siteType ?? 'other') : null
  const subLabel = isWeb ? sub!.label : KIND_LABEL[skill.kind]
  return (
    <button
      className={`cover ${isWeb ? 'cover-web' : 'cover-book'} ${skill.status === 'archived' ? 'cover-archived' : ''} ${skill.status === 'using' ? 'cover-using' : ''}`}
      style={style}
      onClick={onOpen}
      title={`${skill.name}\n${subLabel} · ${cats.map((c) => categoryLabel(c, rules)).join(', ')}\n${skill.description.slice(0, 140)}`}
    >
      <span className="cover-kind">
        {isWeb && <img className="cover-favicon" src={skill.web?.favicon} alt="" loading="lazy" />}
        <span>{isWeb ? sub!.label : KIND_TAG[skill.kind]}</span>
      </span>
      <span className="cover-title">{skill.name}</span>
      <span className="cover-foot">
        <span className="cover-author">{isWeb ? skill.web?.domain : skill.meta.fullName.split('/')[0]}</span>
        {!isWeb && skill.meta.stars > 0 && <span>★{starText(skill.meta.stars)}</span>}
      </span>
    </button>
  )
}

export function Bookshelf({ skills, rules, groupBy, onOpen }: { skills: SavedSkill[]; rules: CategoryRule[]; groupBy: GroupBy; onOpen: (id: string) => void }) {
  const shelves = useMemo(() => groupSkills(skills, rules, groupBy), [skills, rules, groupBy])
  if (!skills.length) return null
  return (
    <div className="bookcase">
      {shelves.map((sh) => (
        <section key={sh.key} className="shelf" style={{ '--n': Math.min(sh.items.length, 10) } as React.CSSProperties}>
          <h3 className="shelf-plaque">
            {sh.label} <small>{sh.items.length}</small>
          </h3>
          <div className="shelf-row">
            {sh.items.map((s) => (
              <Cover key={s.id} skill={s} rules={rules} onOpen={() => onOpen(s.id)} />
            ))}
          </div>
          <div className="shelf-board" />
        </section>
      ))}
    </div>
  )
}
