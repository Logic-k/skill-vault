import { KIND_LABEL, type CategoryRule, type SavedSkill } from '../lib/types'
import { categoryLabel } from '../lib/categorize'

export const STATUS_LABEL = { want: '써볼 것', using: '사용 중', archived: '보관' } as const

export function SkillCard({ skill, rules, onOpen }: { skill: SavedSkill; rules: CategoryRule[]; onOpen: () => void }) {
  const cats = skill.manualCategories ?? skill.categories
  return (
    <button className="card" onClick={onOpen}>
      <div className="card-top">
        <span className={`kind kind-${skill.kind}`}>{KIND_LABEL[skill.kind]}</span>
        {skill.status && <span className={`status status-${skill.status}`}>{STATUS_LABEL[skill.status]}</span>}
        {!skill.analyzedAt && <span className="pill muted">분석 전</span>}
      </div>
      <h3 className="card-title">{skill.name}</h3>
      <div className="card-repo">{skill.meta.fullName}{skill.source.path ? ` / ${skill.source.path}` : ''}</div>
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
