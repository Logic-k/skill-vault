import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddBar } from './components/AddBar'
import { SettingsPanel } from './components/SettingsPanel'
import { SkillCard, STATUS_LABEL } from './components/SkillCard'
import { SkillDetail } from './components/SkillDetail'
import { buildSeed } from './data/seed'
import { analyzeRepo } from './lib/analyzers'
import { allCategories, categorize, categoryLabel } from './lib/categorize'
import { parseGitHubUrl, setTokenProvider } from './lib/github'
import { skillId, store, useStore } from './lib/store'
import { KIND_LABEL, type RepoRef, type SavedSkill, type SkillKind, type SubItem } from './lib/types'

setTokenProvider(() => store.get().settings.token)

export default function App() {
  const { skills, settings, seeded } = useStore()
  const rules = useMemo(() => allCategories(settings.customCategories), [settings.customCategories])

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<SavedSkill | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string>('')
  const [kind, setKind] = useState<SkillKind | ''>('')
  const [status, setStatus] = useState<'' | keyof typeof STATUS_LABEL>('')

  useEffect(() => {
    if (!seeded && skills.length === 0) store.addMany(buildSeed(settings.customCategories), true)
  }, [seeded, skills.length, settings.customCategories])

  const run = useCallback(
    async (ref: RepoRef, existing?: SavedSkill) => {
      setBusy(true)
      setError('')
      try {
        const r = await analyzeRepo(ref, setProgress)
        const id = skillId(ref.owner, ref.repo, r.source.path)
        const prev = existing ?? skills.find((s) => s.id === id)
        const item: SavedSkill = {
          ...r.analysis,
          name: prev?.name ?? r.analysis.name,
          id,
          source: r.source,
          resolvedRef: r.resolvedRef,
          meta: r.meta,
          categories: categorize({ ...r.analysis, note: prev?.note }, r.meta, rules),
          manualCategories: prev?.manualCategories,
          note: prev?.note,
          status: prev?.status ?? 'want',
          tags: [...new Set([...r.analysis.tags, ...(prev?.tags.filter((t) => t.startsWith('서재:')) ?? [])])],
          analyzedAt: new Date().toISOString(),
          addedAt: prev?.addedAt ?? new Date().toISOString(),
        }
        if (prev) {
          store.upsertSkill(item)
          setPreview(null)
          setOpenId(id)
        } else {
          setPreview(item)
          setOpenId(null)
        }
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(false)
        setProgress('')
      }
    },
    [rules, skills],
  )

  const onAnalyze = (url: string) => {
    const ref = parseGitHubUrl(url)
    if (ref) run(ref)
  }

  const current = preview ?? skills.find((s) => s.id === openId) ?? null
  const isSaved = !!current && skills.some((s) => s.id === current.id)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return skills.filter((s) => {
      const cats = s.manualCategories ?? s.categories
      if (cat && !cats.includes(cat)) return false
      if (kind && s.kind !== kind) return false
      if (status && s.status !== status) return false
      if (!q) return true
      const hay = [s.name, s.description, s.meta.fullName, s.note ?? '', ...s.tags, ...s.dependencies.map((d) => d.name)].join(' ').toLowerCase()
      return q.split(/\s+/).every((w) => hay.includes(w))
    })
  }, [skills, query, cat, kind, status])

  const catCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of skills) for (const c of s.manualCategories ?? s.categories) m.set(c, (m.get(c) ?? 0) + 1)
    return m
  }, [skills])
  const kindCounts = useMemo(() => {
    const m = new Map<SkillKind, number>()
    for (const s of skills) m.set(s.kind, (m.get(s.kind) ?? 0) + 1)
    return m
  }, [skills])

  const close = useCallback(() => {
    setPreview(null)
    setOpenId(null)
  }, [])

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo">▣</span>
          <div>
            <h1>Skill Vault</h1>
            <div className="muted small">GitHub 스킬·플러그인·오픈소스를 모아 두고 바로 적용하기</div>
          </div>
        </div>
        <button className="btn" onClick={() => setShowSettings(true)}>설정</button>
      </header>

      <AddBar busy={busy} progress={progress} onAnalyze={onAnalyze} />
      {error && (
        <div className="error">
          {error} <button className="btn link" onClick={() => setError('')}>닫기</button>
        </div>
      )}

      <div className="layout">
        <nav className="side">
          <input className="input" placeholder="검색 (이름, 설명, 태그, 의존성)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <h4>카테고리</h4>
          <ul className="filters">
            <li>
              <button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>전체 <span>{skills.length}</span></button>
            </li>
            {[...rules.map((r) => r.id), 'etc']
              .filter((id) => catCounts.get(id))
              .map((id) => (
                <li key={id}>
                  <button className={cat === id ? 'on' : ''} onClick={() => setCat(cat === id ? '' : id)}>
                    {categoryLabel(id, rules)} <span>{catCounts.get(id)}</span>
                  </button>
                </li>
              ))}
          </ul>
          <h4>종류</h4>
          <ul className="filters">
            {(Object.keys(KIND_LABEL) as SkillKind[])
              .filter((k) => kindCounts.get(k))
              .map((k) => (
                <li key={k}>
                  <button className={kind === k ? 'on' : ''} onClick={() => setKind(kind === k ? '' : k)}>
                    {KIND_LABEL[k]} <span>{kindCounts.get(k)}</span>
                  </button>
                </li>
              ))}
          </ul>
          <h4>상태</h4>
          <ul className="filters">
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
              <li key={s}>
                <button className={status === s ? 'on' : ''} onClick={() => setStatus(status === s ? '' : s)}>
                  {STATUS_LABEL[s]} <span>{skills.filter((x) => x.status === s).length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="grid-wrap">
          {skills.length === 0 ? (
            <div className="empty">
              <p>아직 비어 있습니다. 위에 GitHub 링크를 붙여넣어 시작하세요.</p>
              <button className="btn" onClick={() => store.addMany(buildSeed(settings.customCategories), true)}>예시 33건 불러오기</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty"><p>조건에 맞는 항목이 없습니다.</p></div>
          ) : (
            <div className="grid">
              {filtered.map((s) => (
                <SkillCard key={s.id} skill={s} rules={rules} onOpen={() => { setPreview(null); setOpenId(s.id) }} />
              ))}
            </div>
          )}
        </main>
      </div>

      {current && (
        <SkillDetail
          skill={current}
          saved={isSaved}
          rules={rules}
          busy={busy}
          onSave={(s) => {
            store.upsertSkill(s)
            setPreview(null)
            setOpenId(s.id)
          }}
          onRemove={() => {
            store.removeSkill(current.id)
            close()
          }}
          onReanalyze={() => run({ ...current.source, ref: current.source.ref }, isSaved ? current : undefined)}
          onAnalyzeSub={(it: SubItem) => run({ owner: current.source.owner, repo: current.source.repo, ref: current.source.ref, path: it.path, url: current.source.url })}
          onClose={close}
        />
      )}
      {showSettings && <SettingsPanel settings={settings} count={skills.length} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
