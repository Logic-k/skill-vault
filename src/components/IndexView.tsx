import { useMemo } from 'react'
import { catColor, KIND_TAG } from '../lib/palette'
import { PRICING_LABEL, type CategoryRule, type SavedSkill } from '../lib/types'
import { groupSkills, starText, type GroupBy } from './Bookshelf'

/**
 * 색인: 도서관 카드 목록함처럼 묶음별 서랍에 한 줄씩. 스크롤 없이 전체를 훑어보는 용도.
 */
export function IndexView({ skills, rules, groupBy, onOpen }: { skills: SavedSkill[]; rules: CategoryRule[]; groupBy: GroupBy; onOpen: (id: string) => void }) {
  const groups = useMemo(() => groupSkills(skills, rules, groupBy), [skills, rules, groupBy])
  return (
    <div className="index">
      {groups.map((g) => (
        <section key={g.key} className="drawer" style={{ '--cat': catColor(g.cat ?? 'etc', 8) } as React.CSSProperties}>
          <header className="drawer-head">
            <h3>{g.label}</h3>
            <span className="drawer-count">{g.items.length}</span>
          </header>
          <ul>
            {g.items.map((s) => {
              const isWeb = s.kind === 'website'
              return (
                <li key={s.id}>
                  <button className={`ix-row ${s.status === 'archived' ? 'archived' : ''}`} onClick={() => onOpen(s.id)} title={s.description}>
                    {isWeb ? <img className="ix-icon" src={s.web?.favicon} alt="" loading="lazy" /> : <span className={`ix-tag tag-${s.kind}`}>{KIND_TAG[s.kind]}</span>}
                    <span className="ix-name">{s.name}</span>
                    <span className="ix-desc">{s.description}</span>
                    <span className="ix-meta">
                      {s.status === 'using' && <i className="ix-using" title="사용 중" />}
                      {isWeb ? (s.web && s.web.pricing !== 'unknown' ? PRICING_LABEL[s.web.pricing] : '') : s.meta.stars > 0 ? `★ ${starText(s.meta.stars)}` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
