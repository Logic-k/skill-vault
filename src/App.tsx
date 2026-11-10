import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddBar } from './components/AddBar'
import { Bookshelf, type GroupBy } from './components/Bookshelf'
import { IndexView } from './components/IndexView'
import { Overview } from './components/Overview'
import { SettingsPanel } from './components/SettingsPanel'
import { SkillCard, STATUS_LABEL } from './components/SkillCard'
import { SkillDetail } from './components/SkillDetail'
import { buildSeed } from './data/seed'
import { SITE_TYPES, SITE_TYPE_FALLBACK } from './data/siteTypes'
import { analyzeRepo } from './lib/analyzers'
import { allCategories, categorize } from './lib/categorize'
import { parseGitHubUrl, setTokenProvider } from './lib/github'
import { skillId, store, useStore } from './lib/store'
import { KIND_LABEL, type RepoRef, type SavedSkill, type SkillKind, type SubItem } from './lib/types'
import { analyzeWebsite, normalizeUrl, webId, websiteShell } from './lib/web'

setTokenProvider(() => store.get().settings.token)

type View = 'index' | 'shelf' | 'cards'

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
  const [view, setView] = usePref<View>('skill-vault/view2', 'index')
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
  const kindCounts = useMemo(() => count<SkillKind>((s) => (s.kind === 'website' ? [] : [s.kind])), [skills])
  const siteCounts = useMemo(() => count((s) => (s.kind === 'website' ? [s.web?.siteType ?? 'other'] : [])), [skills])
  const webTotal = skills.filter((s) => s.kind === 'website').length

  const anyFilter = !!(query.trim() || cat || kind || source || siteType || status)
  const clearFilters = () => {
    setQuery('')
    setCat('')
    setKind('')
    setSource('')
    setSiteType('')
    setStatus('')
  }

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
          <span className="logo" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <h1>Skill Vault</h1>
            <p className="tagline">GitHub 스킬·플러그인과 AI 웹사이트를 한 서재에 모아 두고 바로 꺼내 쓰기</p>
          </div>
        </div>
        <button className="btn ghost" onClick={() => setShowSettings(true)}>설정</button>
      </header>

      <AddBar busy={busy} progress={progress} onAnalyze={onAnalyze} />
      {error && (
        <div className="error" role="alert">
          {error} <button className="btn link" onClick={() => setError('')}>닫기</button>
        </div>
      )}

      {skills.length > 0 && (
        <Overview
          skills={skills}
          rules={rules}
          cat={cat}
          source={source}
          status={status}
          onCat={(id) => setCat(cat === id ? '' : id)}
          onSource={(s) => {
            setSource(s)
            if (s === 'github') setSiteType('')
            if (s === 'web') setKind('')
          }}
          onStatus={setStatus}
        />
      )}

      {skills.length > 0 && (
        <div className="toolbar">
          <input className="input search" type="search" placeholder="검색: 이름, 설명, 주소, 태그, 메모" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="검색" />
          {view !== 'cards' && (
            <div className="seg" role="group" aria-label="묶는 기준">
              <button className={groupBy === 'category' ? 'on' : ''} onClick={() => setGroupBy('category')}>주제별</button>
              <button className={groupBy === 'siteType' ? 'on' : ''} onClick={() => setGroupBy('siteType')}>사이트 유형별</button>
              <button className={groupBy === 'kind' ? 'on' : ''} onClick={() => setGroupBy('kind')}>종류별</button>
            </div>
          )}
          <div className="seg" role="group" aria-label="보기 방식">
            <button className={view === 'index' ? 'on' : ''} onClick={() => setView('index')}>색인</button>
            <button className={view === 'shelf' ? 'on' : ''} onClick={() => setView('shelf')}>서재</button>
            <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>카드</button>
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div className="subfilters">
          {webTotal > 0 && source !== 'github' && (
            <div className="subfilter-group">
              <span className="subfilter-label">사이트 유형</span>
              {[...SITE_TYPES, SITE_TYPE_FALLBACK]
                .filter((t) => siteCounts.get(t.id))
                .map((t) => (
                  <button key={t.id} className={`chip ${siteType === t.id ? 'on' : ''}`} onClick={() => setSiteType(siteType === t.id ? '' : t.id)} aria-pressed={siteType === t.id}>
                    {t.label} <span>{siteCounts.get(t.id)}</span>
                  </button>
                ))}
            </div>
          )}
          {source !== 'web' && (
            <div className="subfilter-group">
              <span className="subfilter-label">GitHub 종류</span>
              {(Object.keys(KIND_LABEL) as SkillKind[])
                .filter((k) => kindCounts.get(k))
                .map((k) => (
                  <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(kind === k ? '' : k)} aria-pressed={kind === k}>
                    {KIND_LABEL[k]} <span>{kindCounts.get(k)}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <main className="content">
        {skills.length === 0 ? (
          <div className="empty">
            <h2>서재가 비어 있습니다</h2>
            <p>위 입력창에 GitHub 링크나 AI 사이트 주소를 붙여넣으면 첫 책이 꽂힙니다.</p>
            <button className="btn primary" onClick={() => store.addMany(buildSeed(settings.customCategories), true)}>예시 서재로 시작하기</button>
          </div>
        ) : (
          <>
            <div className="result-line">
              <span>
                {anyFilter ? (
                  <>
                    <b>{filtered.length}</b>권 <span className="muted">/ 전체 {skills.length}권</span>
                  </>
                ) : (
                  <>
                    <b>{skills.length}</b>권이 꽂혀 있습니다
                  </>
                )}
              </span>
              {anyFilter && (
                <button className="btn link" onClick={clearFilters}>필터 지우기</button>
              )}
            </div>
            {filtered.length === 0 ? (
              <div className="empty">
                <h2>맞는 책이 없습니다</h2>
                <p>검색어나 필터를 줄여 보세요.</p>
                <button className="btn" onClick={clearFilters}>필터 지우기</button>
              </div>
            ) : view === 'index' ? (
              <IndexView skills={filtered} rules={rules} groupBy={groupBy} onOpen={open} />
            ) : view === 'shelf' ? (
              <Bookshelf skills={filtered} rules={rules} groupBy={groupBy} onOpen={open} />
            ) : (
              <div className="grid">
                {filtered.map((s) => (
                  <SkillCard key={s.id} skill={s} rules={rules} onOpen={() => open(s.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

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
