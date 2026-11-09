import { useEffect, useState } from 'react'
import { categoryLabel } from '../lib/categorize'
import { KIND_LABEL, PRICING_LABEL, type CategoryRule, type Dependency, type Pricing, type SavedSkill, type SubItem } from '../lib/types'
import { SITE_TYPES, SITE_TYPE_FALLBACK, siteTypeLabel } from '../data/siteTypes'
import { formatBytes } from '../lib/analyzers/common'
import { downloadZip } from '../lib/zip'
import { Markdown } from './Markdown'
import { STATUS_LABEL } from './SkillCard'

const DEP_LABEL: Record<Dependency['kind'], string> = {
  runtime: '런타임',
  tool: '시스템 도구',
  npm: 'npm 패키지',
  pip: 'Python 패키지',
  mcp: 'MCP 서버',
  env: '환경 변수 / 키',
  skill: '다른 스킬',
  other: '기타',
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      className="btn tiny"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setOk(true)
          setTimeout(() => setOk(false), 1200)
        })
      }}
    >
      {ok ? '복사됨' : '복사'}
    </button>
  )
}

export interface DetailProps {
  skill: SavedSkill
  saved: boolean
  rules: CategoryRule[]
  busy: boolean
  onSave: (s: SavedSkill) => void
  onRemove: () => void
  onReanalyze: () => void
  onAnalyzeSub: (item: SubItem) => void
  onClose: () => void
}

export function SkillDetail({ skill, saved, rules, busy, onSave, onRemove, onReanalyze, onAnalyzeSub, onClose }: DetailProps) {
  const [draft, setDraft] = useState(skill)
  const [tab, setTab] = useState<'overview' | 'files' | 'readme'>('overview')
  const [zipMsg, setZipMsg] = useState('')
  useEffect(() => {
    setDraft(skill)
    setTab('overview')
  }, [skill])
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const isWeb = skill.kind === 'website'
  const cats = draft.manualCategories ?? draft.categories
  const toggleCat = (id: string) => {
    const next = cats.includes(id) ? cats.filter((c) => c !== id) : [...cats, id]
    setDraft({ ...draft, manualCategories: next })
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(skill)
  const treeUrl = `${skill.source.url}/tree/${skill.resolvedRef}${skill.source.path ? '/' + skill.source.path : ''}`
  const rawBase = `https://raw.githubusercontent.com/${skill.source.owner}/${skill.source.repo}/${skill.resolvedRef}${skill.source.path ? '/' + skill.source.path : ''}`
  const grouped = draft.dependencies.reduce<Record<string, Dependency[]>>((acc, d) => ((acc[d.kind] ??= []).push(d), acc), {})
  const blobs = skill.files.filter((f) => f.type === 'blob')

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="detail" onClick={(e) => e.stopPropagation()}>
        <header className="detail-head">
          <div>
            <div className="card-top">
              {isWeb ? (
                <span className="kind kind-website">{siteTypeLabel(draft.web?.siteType ?? 'other').icon} {siteTypeLabel(draft.web?.siteType ?? 'other').label}</span>
              ) : (
                <span className={`kind kind-${skill.kind}`}>{KIND_LABEL[skill.kind]}</span>
              )}
              {isWeb && draft.web && draft.web.pricing !== 'unknown' && <span className={`pill price-${draft.web.pricing}`}>{PRICING_LABEL[draft.web.pricing]}</span>}
              {!skill.analyzedAt && <span className="pill muted">아직 분석 전</span>}
              {skill.analyzedAt && <span className="pill muted">분석 {new Date(skill.analyzedAt).toLocaleDateString()}</span>}
            </div>
            <h2>
              {isWeb && <img className="favicon" src={skill.web?.favicon} alt="" />}
              {isWeb ? (
                <input className="title-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              ) : (
                skill.name
              )}
            </h2>
            <div className="card-repo">
              <a href={isWeb ? skill.web?.url : treeUrl} target="_blank" rel="noreferrer">{isWeb ? skill.web?.url : `${skill.meta.fullName}${skill.source.path ? ` / ${skill.source.path}` : ''}`}</a>
              {skill.meta.stars > 0 && <span> · ★ {skill.meta.stars.toLocaleString()}</span>}
              {skill.meta.license && <span> · {skill.meta.license}</span>}
              {skill.meta.language && <span> · {skill.meta.language}</span>}
            </div>
          </div>
          <button className="btn icon" onClick={onClose} aria-label="닫기">✕</button>
        </header>

        {isWeb ? (
          <textarea className="detail-desc desc-input" rows={3} placeholder="이 사이트가 무엇을 하는지 한두 줄로 적어 두세요." value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        ) : (
          <p className="detail-desc">{skill.description}</p>
        )}
        {isWeb && skill.web?.image && <img className="detail-cover" src={skill.web.image} alt="" />}

        {skill.warnings.length > 0 && (
          <div className="warn">
            {skill.warnings.map((w, i) => (
              <div key={i}>⚠ {w}</div>
            ))}
          </div>
        )}

        <div className="tabs">
          <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>개요</button>
          {!isWeb && (<>
          <button className={tab === 'files' ? 'on' : ''} onClick={() => setTab('files')}>파일 {blobs.length > 0 && `(${blobs.length})`}</button>
          <button className={tab === 'readme' ? 'on' : ''} onClick={() => setTab('readme')} disabled={!skill.skillMd && !skill.readme}>
            {skill.skillMd ? 'SKILL.md' : 'README'}
          </button>
          </>)}
        </div>

        {tab === 'overview' && (
          <div className="detail-body">
            {isWeb && draft.web && (
              <section>
                <h4>사이트 유형과 가격 <small>(자동 감지, 바꿀 수 있어요)</small></h4>
                <div className="chips">
                  {[...SITE_TYPES, SITE_TYPE_FALLBACK].map((t) => (
                    <button key={t.id} className={`chip ${draft.web?.siteType === t.id ? 'on' : ''}`} onClick={() => setDraft({ ...draft, web: { ...draft.web!, siteType: t.id } })}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  {(Object.keys(PRICING_LABEL) as Pricing[]).map((p) => (
                    <button key={p} className={`chip ${draft.web?.pricing === p ? 'on' : ''}`} onClick={() => setDraft({ ...draft, web: { ...draft.web!, pricing: p } })}>
                      {PRICING_LABEL[p]}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <a className="btn primary" href={draft.web.url} target="_blank" rel="noreferrer">사이트 열기 ↗</a>
                  <CopyButton text={draft.web.url} />
                  {draft.web.fetchedWith && <span className="muted small">정보 출처: {draft.web.fetchedWith === 'manual' ? '직접 입력' : draft.web.fetchedWith}</span>}
                </div>
              </section>
            )}
            <section>
              <h4>카테고리 <small>(클릭해서 바꿀 수 있어요)</small></h4>
              <div className="chips">
                {rules.map((r) => (
                  <button key={r.id} className={`chip ${cats.includes(r.id) ? 'on' : ''}`} onClick={() => toggleCat(r.id)}>
                    {r.label}
                  </button>
                ))}
                <button className={`chip ${cats.includes('etc') ? 'on' : ''}`} onClick={() => toggleCat('etc')}>기타</button>
              </div>
              {draft.manualCategories && (
                <button className="btn link" onClick={() => setDraft({ ...draft, manualCategories: undefined })}>
                  자동 분류로 되돌리기 ({skill.categories.map((c) => categoryLabel(c, rules)).join(', ')})
                </button>
              )}
            </section>

            <section>
              <h4>상태와 메모</h4>
              <div className="row">
                {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
                  <button key={s} className={`chip ${draft.status === s ? 'on' : ''}`} onClick={() => setDraft({ ...draft, status: s })}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <textarea
                className="note"
                placeholder="왜 저장했는지, 주의할 점 등을 적어 두세요."
                value={draft.note ?? ''}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                rows={3}
              />
            </section>

            {skill.tags.length > 0 && (
              <section>
                <h4>태그</h4>
                <div className="chips">
                  {skill.tags.map((t) => (
                    <span key={t} className="chip soft">{t}</span>
                  ))}
                </div>
              </section>
            )}

            {!isWeb && (<section>
              <h4>필요한 것 {draft.dependencies.length > 0 && <small>({draft.dependencies.length})</small>}</h4>
              {draft.dependencies.length === 0 && <p className="muted">{skill.analyzedAt ? '감지된 의존성이 없습니다. 마크다운만 있는 스킬일 가능성이 큽니다.' : '아직 분석하지 않았습니다.'}</p>}
              {Object.entries(grouped).map(([k, list]) => (
                <div key={k} className="dep-group">
                  <div className="dep-kind">{DEP_LABEL[k as Dependency['kind']]}</div>
                  <ul>
                    {list.map((d) => (
                      <li key={d.name}>
                        <code>{d.name}</code>
                        {d.detail && <span className="muted"> — {d.detail}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>)}

            {!isWeb && (<section>
              <h4>적용 방법</h4>
              {skill.install.map((st, i) => (
                <div key={i} className="install">
                  <div className="install-title">{st.title}</div>
                  {st.command && (
                    <div className="cmd">
                      <pre>{st.command}</pre>
                      <CopyButton text={st.command} />
                    </div>
                  )}
                  {st.note && <div className="muted small">{st.note}</div>}
                </div>
              ))}
              {skill.analyzedAt && blobs.length > 0 && (
                <div className="row">
                  <button
                    className="btn"
                    disabled={busy || !!zipMsg}
                    onClick={async () => {
                      try {
                        await downloadZip(
                          skill.source.owner,
                          skill.source.repo,
                          skill.resolvedRef,
                          skill.source.path,
                          skill.files,
                          skill.name.toLowerCase().replace(/[^a-z0-9가-힣._-]+/g, '-'),
                          (d, t) => setZipMsg(`${d}/${t} 받는 중…`),
                        )
                        setZipMsg('')
                      } catch (e) {
                        setZipMsg('')
                        alert((e as Error).message)
                      }
                    }}
                  >
                    {zipMsg || 'ZIP 내려받기'}
                  </button>
                  <span className="muted small">{blobs.length}개 파일, {formatBytes(blobs.reduce((n, f) => n + (f.size ?? 0), 0))}</span>
                </div>
              )}
            </section>)}

            {skill.subItems && skill.subItems.length > 0 && (
              <section>
                <h4>포함된 항목 <small>({skill.subItems.length})</small></h4>
                <ul className="sublist">
                  {skill.subItems.map((it) => (
                    <li key={it.path || it.name}>
                      <div>
                        <strong>{it.name}</strong> <span className="kind">{KIND_LABEL[it.kind]}</span>
                        {it.description && <div className="muted small">{it.description}</div>}
                        {it.path && <div className="muted small mono">{it.path}</div>}
                      </div>
                      {it.path && (
                        <button className="btn tiny" disabled={busy} onClick={() => onAnalyzeSub(it)}>
                          따로 분석
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {skill.frontmatter && Object.keys(skill.frontmatter).length > 0 && (
              <section>
                <h4>SKILL.md 메타데이터</h4>
                <pre className="small">{JSON.stringify(skill.frontmatter, null, 2)}</pre>
              </section>
            )}
          </div>
        )}

        {tab === 'files' && (
          <div className="detail-body">
            {blobs.length === 0 && <p className="muted">파일 목록이 없습니다. 먼저 분석을 실행하세요.</p>}
            <ul className="files">
              {blobs.map((f) => (
                <li key={f.path} className={skill.entryFiles.includes(f.path) ? 'entry' : ''}>
                  <a href={`${rawBase}/${f.path}`} target="_blank" rel="noreferrer" className="mono">{f.path}</a>
                  <span className="muted small">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'readme' && (
          <div className="detail-body">
            <Markdown text={skill.skillMd ?? skill.readme ?? ''} baseUrl={rawBase} />
          </div>
        )}

        <footer className="detail-foot">
          <div className="row">
            <button className="btn" onClick={onReanalyze} disabled={busy}>
              {busy ? '분석 중…' : skill.analyzedAt ? '다시 분석' : isWeb ? '사이트 정보 읽기' : 'GitHub에서 분석'}
            </button>
            {saved && (
              <button className="btn danger" onClick={() => confirm('보관함에서 지울까요?') && onRemove()}>
                삭제
              </button>
            )}
          </div>
          <button className="btn primary" onClick={() => onSave(draft)} disabled={saved && !dirty}>
            {saved ? (dirty ? '변경 저장' : '저장됨') : '보관함에 추가'}
          </button>
        </footer>
      </aside>
    </div>
  )
}
