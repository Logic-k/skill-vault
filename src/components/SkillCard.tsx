import { siteTypeLabel } from '../data/siteTypes'
import { categoryLabel } from '../lib/categorize'
import { catColor } from '../lib/palette'
import { KIND_LABEL, PRICING_LABEL, type CategoryRule, type SavedSkill } from '../lib/types'

export const STATUS_LABEL = { want: '써볼 것', using: '사용 중', archived: '보관' } as const

export function SkillCard({ skill, rules, onOpen }: { skill: SavedSkill; rules: CategoryRule[]; onOpen: () => void }) {
  const cats = skill.manualCategories ?? skill.categories
  const isWeb = skill.kind === 'website'
  const st = isWeb ? siteTypeLabel(skill.web?.siteType ?? 'other') : null
  return (
    <button className={`card ${isWeb ? 'card-web' : ''}`} onClick={onOpen} style={{ '--cat': catColor(cats[0] ?? 'etc', 8) } as React.CSSProperties}>
      {isWeb && skill.web?.image && <div className="card-cover" style={{ backgroundImage: `url("${skill.web.image}")` }} />}
      <div className="card-top">
        {isWeb ? (
          <span className="kind kind-website">{st?.label}</span>
        ) : (
          <span className={`kind kind-${skill.kind}`}>{KIND_LABEL[skill.kind]}</span>
        )}
        {skill.status && <span className={`status status-${skill.status}`}>{STATUS_LABEL[skill.status]}</span>}
        {isWeb && skill.web && skill.web.pricing !== 'unknown' && <span className={`pill price-${skill.web.pricing}`}>{PRICING_LABEL[skill.web.pricing]}</span>}
        {!skill.analyzedAt && <span className="pill muted">분석 전</span>}
      </div>
      <h3 className="card-title">
        {isWeb && <img className="favicon" src={skill.web?.favicon} alt="" loading="lazy" />}
        {skill.name}
      </h3>
      <div className="card-repo">{isWeb ? skill.web?.domain : `${skill.meta.fullName}${skill.source.path ? ` / ${skill.source.path}` : ''}`}</div>
      <p className="card-desc">{skill.description}</p>
      <div className="card-bottom">
        <div className="chips">
          {cats.map((c) => (
            <span key={c} className="chip">{categoryLabel(c, rules)}</span>
          ))}
        </div>
        <div className="card-meta">
          {skill.meta.stars > 0 && <span title="별">★ {skill.meta.stars.toLocaleString()}</span>}
          {skill.meta.license && <span>{skill.meta.license}</span>}
          {skill.dependencies.length > 0 && <span>의존성 {skill.dependencies.length}</span>}
        </div>
      </div>
    </button>
  )
}
