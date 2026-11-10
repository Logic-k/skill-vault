import { useMemo } from 'react'
import { categoryLabel } from '../lib/categorize'
import { catColor } from '../lib/palette'
import type { CategoryRule, SavedSkill } from '../lib/types'

type Source = '' | 'github' | 'web'
type Status = '' | 'want' | 'using' | 'archived'

export function Overview({
  skills,
  rules,
  cat,
  source,
  status,
  onCat,
  onSource,
  onStatus,
}: {
  skills: SavedSkill[]
  rules: CategoryRule[]
  cat: string
  source: Source
  status: Status
  onCat: (id: string) => void
  onSource: (s: Source) => void
  onStatus: (s: Status) => void
}) {
  const stats = useMemo(() => {
    const web = skills.filter((s) => s.kind === 'website').length
    const by = (st: Status) => skills.filter((s) => s.status === st).length
    const primary = new Map<string, number>()
    const any = new Map<string, number>()
    for (const s of skills) {
      const cats = s.manualCategories ?? s.categories
      const p = cats[0] ?? 'etc'
      primary.set(p, (primary.get(p) ?? 0) + 1)
      for (const c of cats) any.set(c, (any.get(c) ?? 0) + 1)
    }
    const order = [...rules.map((r) => r.id), 'etc']
    return { web, gh: skills.length - web, want: by('want'), using: by('using'), archived: by('archived'), primary, any, order }
  }, [skills, rules])

  const tiles: { n: number; label: string; on: boolean; click: () => void }[] = [
    { n: skills.length, label: '전체', on: source === '' && status === '', click: () => { onSource(''); onStatus('') } },
    { n: stats.gh, label: 'GitHub', on: source === 'github', click: () => onSource(source === 'github' ? '' : 'github') },
    { n: stats.web, label: 'AI 웹사이트', on: source === 'web', click: () => onSource(source === 'web' ? '' : 'web') },
    { n: stats.want, label: '써볼 것', on: status === 'want', click: () => onStatus(status === 'want' ? '' : 'want') },
    { n: stats.using, label: '사용 중', on: status === 'using', click: () => onStatus(status === 'using' ? '' : 'using') },
    { n: stats.archived, label: '보관', on: status === 'archived', click: () => onStatus(status === 'archived' ? '' : 'archived') },
  ]

  return (
    <section className="overview" aria-label="서재 요약">
      <div className="stats">
        {tiles.map((t) => (
          <button key={t.label} className={`stat ${t.on ? 'on' : ''}`} onClick={t.click} aria-pressed={t.on}>
            <span className="stat-n">{t.n}</span>
            <span className="stat-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="dist">
        <div className="dist-bar" role="img" aria-label="주제별 분포">
          {stats.order
            .filter((id) => stats.primary.get(id))
            .map((id) => (
              <button
                key={id}
                className={`dist-seg ${cat && cat !== id ? 'dim' : ''}`}
                style={{ flexGrow: stats.primary.get(id), background: catColor(id, 8) }}
                title={`${categoryLabel(id, rules)} ${stats.primary.get(id)}권`}
                onClick={() => onCat(id)}
              />
            ))}
        </div>
        <div className="dist-legend">
          {stats.order
            .filter((id) => stats.any.get(id))
            .map((id) => (
              <button key={id} className={`legend ${cat === id ? 'on' : ''}`} onClick={() => onCat(id)} aria-pressed={cat === id}>
                <i style={{ background: catColor(id, 8) }} />
                {categoryLabel(id, rules)}
                <span>{stats.any.get(id)}</span>
              </button>
            ))}
        </div>
      </div>
    </section>
  )
}
