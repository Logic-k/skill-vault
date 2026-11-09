import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddBar } from './components/AddBar'
import { Bookshelf } from './components/Bookshelf'
import { SettingsPanel } from './components/SettingsPanel'
import { SkillCard, STATUS_LABEL } from './components/SkillCard'
import { SkillDetail } from './components/SkillDetail'
import { buildSeed } from './data/seed'
import { SITE_TYPES, SITE_TYPE_FALLBACK } from './data/siteTypes'
import { analyzeRepo } from './lib/analyzers'
import { allCategories, categorize, categoryLabel } from './lib/categorize'
import { parseGitHubUrl, setTokenProvider } from './lib/github'
import { skillId, store, useStore } from './lib/store'
import { KIND_LABEL, type RepoRef, type SavedSkill, type SkillKind, type SubItem } from './lib/types'
import { analyzeWebsite, normalizeUrl, webId, websiteShell } from './lib/web'

setTokenProvider(() => store.get().settings.token)

type View = 'shelf' | 'cards'
type GroupBy = 'category' | 'kind' | 'siteType'

function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T) || fallback
    } catch {
      return fallback
    }
  })
  return [
    v,
    (n) => {
      setV(n)
      try {
        localStorage.setItem(key, n)
      } catch {
        /* ignore */
      }
    },
  ]
}

export default function App() {
  const { skills, settings, seeded } = useStore()
  const rules = useMemo(() => allCategories(settings.customCategories), [settings.customCategories])

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<SavedSkill | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [view, setView] = usePref<View>('skill-vault/view', 'shelf')
  const [groupBy, setGroupBy] = usePref<GroupBy>('skill-vault/groupBy', 'category')
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string>('')
  const [kind, setKind] = useState<SkillKind | ''>('')
  const [source, setSource] = useState<'' | 'github' | 'web'>('')
  const [siteType, setSiteType] = useState('')
  const [status, setStatus] = useState<'' | keyof typeof STATUS_LABEL>('')

  useEffect(() => {
    if (!seeded && skills.length === 0) store.addMany(buildSeed(settings.customCategories), true)
  }, [seeded, skills.length, settings.customCategories])

  const finish = useCallback((item: SavedSkill, prev: SavedSkill | undefined) => {
    if (prev) {
      store.upsertSkill(item)
      setPreview(null)
      setOpenId(item.id)
    } else {
      setPreview(item)
      setOpenId(null)
    }
  }, [])

  const runRepo = useCallback(
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
        finish(item, prev)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(false)
        setProgress('')
      }
    },
    [rules, skills, finish],
  )

  const runWeb = useCallback(
    async (url: string, existing?: SavedSkill) => {
      const u = normalizeUrl(url)
      if (!u) return
      setBusy(true)
      setError('')
      try {
        const a = await analyzeWebsite(u.toString(), setProgress)
        const id = webId(u)
        const prev = existing ?? skills.find((s) => s.id === id)
        const shell = websiteShell(a, u)
        const keepManual = prev && prev.web?.fetchedWith === 'manual'
        const base = {
          ...shell,
          id,
          name: prev?.name && (keepManual || a.web.fetchedWith === 'manual') ? prev.name : a.name,
          description: prev?.description && (keepManual || a.web.fetchedWith === 'manual') ? prev.description : a.description,
          tags: [...new Set([...a.tags, ...(prev?.tags.filter((t) => t.startsWith('서재:')) ?? [])])],
          warnings: a.warnings,
          readme: a.content || undefined,
          web: { ...a.web, siteType: prev?.web && prev.analyzedAt ? prev.web.siteType : a.web.siteType, pricing: prev?.web && prev.analyzedAt ? prev.web.pricing : a.web.pricing },
          note: prev?.note,
          status: prev?.status ?? 'want',
          manualCategories: prev?.manualCategories,
          analyzedAt: a.web.fetchedWith === 'manual' ? prev?.analyzedAt : new Date().toISOString(),
          addedAt: prev?.addedAt ?? new Date().toISOString(),
        }
        const item: SavedSkill = { ...base, categories: categorize({ ...base, note: prev?.note }, shell.meta, rules) }
        finish(item, prev)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(false)
        setProgress('')
      }
    },
    [rules, skills, finish],
  )

  const onAnalyze = (url: string) => {
    const ref = parseGitHubUrl(url)
    if (ref) runRepo(ref)
    else runWeb(url)
  }

  const current = preview ?? skills.find((s) => s.id === openId) ?? null
  const isSaved = !!current && skills.some((s) => s.id === current.id)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return skills.filter((s) => {
      const cats = s.manualCategories ?? s.categories
      if (cat && !cats.includes(cat)) return false
      if (kind && s.kind !== kind) return false
      if (source === 'web' && s.kind !== 'website') return false
      if (source === 'github' && s.kind === 'website') return false
      if (siteType && (s.kind !== 'website' || s.web?.siteType !== siteType)) return false
      if (status && s.status !== status) return false
      if (!q) return true
      const hay = [s.name, s.description, s.meta.fullName, s.web?.url ?? '', s.note ?? '', ...s.tags, ...s.dependencies.map((d) => d.name)].join(' ').toLowerCase()
      return q.split(/\s+/).every((w) => hay.includes(w))
    })
  }, [skills, query, cat, kind, source, siteType, status])

  const count = <K,>(pick: (s: SavedSkill) => K[]) => {
    const m = new Map<K, number>()
    for (const s of skills) for (const k of pick(s)) m.set(k, (m.get(k) ?? 0) + 1)
    return m
  }
  const catCounts = useMemo(() => count((s) => s.manualCategories ?? s.categories), [skills])
  const kindCounts = useMemo(() => count<SkillKind>((s) => (s.kind === 'website' ? [] : [s.kind])), [skills])
  const siteCounts = useMemo(() => count((s) => (s.kind === 'website' ? [s.web?.siteType ?? 'other'] : [])), [skills])
  const webTotal = skills.filter((s) => s.kind === 'website').length

  const close = useCallback(() => {
    setPreview(null)
    setOpenId(null)
  }, [])
  const open = (id: string) => {
    setPreview(null)
    setOpenId(id)
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo">▣</span>
          <div>
            <h1>Skill Vault</h1>
            <div className="muted small">GitHub 스킬·플러그인과 AI 웹사이트를 한 서재에 모아 두고 바로 꺼내 쓰기</div>
          </div>
        </div>
        <div className="row">
          <div className="seg">
            <button className={view === 'shelf' ? 'on' : ''} onClick={() => setView('shelf')} title="서재 보기">📚 서재</button>
            <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')} title="카드 보기">▦ 카드</button>
          </div>
          <button className="btn" onClick={() => setShowSettings(true)}>설정</button>
        </div>
      </header>

      <AddBar busy={busy} progress={progress} onAnalyze={onAnalyze} />
      {error && (
        <div className="error">
          {error} <button className="btn link" onClick={() => setError('')}>닫기</button>
        </div>
      )}

      <div className="layout">
        <nav className="side">
          <input className="input" placeholder="검색 (이름, 설명, 주소, 태그, 메모)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <h4>출처</h4>
          <ul className="filters">
            <li><button className={source === '' ? 'on' : ''} onClick={() => setSource('')}>전체 <span>{skills.length}</span></button></li>
            <li><button className={source === 'github' ? 'on' : ''} onClick={() => { setSource(source === 'github' ? '' : 'github'); setSiteType('') }}>🐙 GitHub <span>{skills.length - webTotal}</span></button></li>
            <li><button className={source === 'web' ? 'on' : ''} onClick={() => { setSource(source === 'web' ? '' : 'web'); setKind('') }}>🌐 AI 웹사이트 <span>{webTotal}</span></button></li>
          </ul>
          <h4>주제</h4>
          <ul className="filters">
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
          {webTotal > 0 && source !== 'github' && (
            <>
              <h4>사이트 유형</h4>
              <ul className="filters">
                {[...SITE_TYPES, SITE_TYPE_FALLBACK]
                  .filter((t) => siteCounts.get(t.id))
                  .map((t) => (
                    <li key={t.id}>
                      <button className={siteType === t.id ? 'on' : ''} onClick={() => setSiteType(siteType === t.id ? '' : t.id)}>
                        {t.icon} {t.label} <span>{siteCounts.get(t.id)}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          )}
          {source !== 'web' && (
            <>
              <h4>GitHub 종류</h4>
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
            </>
          )}
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
              <p>아직 비어 있습니다. 위에 GitHub 링크나 AI 사이트 주소를 붙여넣어 시작하세요.</p>
              <button className="btn" onClick={() => store.addMany(buildSeed(settings.customCategories), true)}>예시 서재 불러오기</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty"><p>조건에 맞는 항목이 없습니다.</p></div>
          ) : view === 'shelf' ? (
            <>
              <div className="shelf-tools">
                <span className="muted small">{filtered.length}권 · 책등을 클릭하면 펼쳐집니다</span>
                <div className="seg small">
                  <button className={groupBy === 'category' ? 'on' : ''} onClick={() => setGroupBy('category')}>주제별 칸</button>
                  <button className={groupBy === 'siteType' ? 'on' : ''} onClick={() => setGroupBy('siteType')}>사이트 유형별</button>
                  <button className={groupBy === 'kind' ? 'on' : ''} onClick={() => setGroupBy('kind')}>종류별</button>
                </div>
              </div>
              <Bookshelf skills={filtered} rules={rules} groupBy={groupBy} onOpen={open} />
            </>
          ) : (
            <div className="grid">
              {filtered.map((s) => (
                <SkillCard key={s.id} skill={s} rules={rules} onOpen={() => open(s.id)} />
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
          onReanalyze={() =>
            current.kind === 'website'
              ? runWeb(current.web!.url, isSaved ? current : undefined)
              : runRepo({ ...current.source, ref: current.source.ref }, isSaved ? current : undefined)
          }
          onAnalyzeSub={(it: SubItem) => runRepo({ owner: current.source.owner, repo: current.source.repo, ref: current.source.ref, path: it.path, url: current.source.url })}
          onClose={close}
        />
      )}
      {showSettings && <SettingsPanel settings={settings} count={skills.length} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
