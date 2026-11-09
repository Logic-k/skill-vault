import { SITE_TYPES, SITE_TYPE_FALLBACK } from '../data/siteTypes'
import type { Pricing, SavedSkill, WebInfo } from './types'

export interface WebAnalysis {
  name: string
  description: string
  content: string
  tags: string[]
  web: WebInfo
  warnings: string[]
}

export function normalizeUrl(input: string): URL | null {
  let s = input.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) {
    if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(s)) s = 'https://' + s
    else return null
  }
  try {
    const u = new URL(s)
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null
    u.hash = ''
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(k)) u.searchParams.delete(k)
    return u
  } catch {
    return null
  }
}

export function domainOf(u: URL) {
  return u.hostname.replace(/^www\./, '')
}

export function faviconFor(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
}

export function webId(u: URL) {
  const path = u.pathname.replace(/\/+$/, '')
  return `web:${domainOf(u)}${path}`.toLowerCase()
}

interface Meta {
  title?: string
  description?: string
  image?: string
  logo?: string
  publisher?: string
  lang?: string
  content?: string
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
}

/** microlink.io: free public metadata API with CORS (title, description, og:image, logo). */
async function viaMicrolink(url: string): Promise<Meta | null> {
  try {
    const res = await withTimeout(fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&palette=false&audio=false&video=false`), 12_000)
    if (!res.ok) return null
    const j = (await res.json()) as { status: string; data?: { title?: string; description?: string; image?: { url?: string }; logo?: { url?: string }; publisher?: string; lang?: string } }
    if (j.status !== 'success' || !j.data) return null
    const d = j.data
    return { title: d.title, description: d.description, image: d.image?.url, logo: d.logo?.url, publisher: d.publisher, lang: d.lang }
  } catch {
    return null
  }
}

/** r.jina.ai: free reader that returns the page as text/JSON with CORS. Used for body text (better classification) or as fallback. */
async function viaJina(url: string): Promise<Meta | null> {
  try {
    const res = await withTimeout(fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'application/json', 'X-Return-Format': 'markdown' } }), 15_000)
    if (!res.ok) return null
    const j = (await res.json()) as { data?: { title?: string; description?: string; content?: string } }
    if (!j.data) return null
    return { title: j.data.title, description: j.data.description, content: j.data.content }
  } catch {
    return null
  }
}

export function detectSiteType(domain: string, path: string, text: string): string {
  const host = domain.toLowerCase()
  const full = `${host}${path}`.toLowerCase()
  for (const t of SITE_TYPES) {
    for (const d of t.domains ?? []) {
      if (d.includes('/') ? full.startsWith(d) : host === d || host.endsWith('.' + d)) return t.id
    }
  }
  const lower = text.toLowerCase()
  let best = SITE_TYPE_FALLBACK.id
  let bestScore = 0
  for (const t of SITE_TYPES) {
    let score = 0
    for (const k of t.keywords) {
      const re = /^[a-z0-9 .+/-]+$/.test(k) ? new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'g') : new RegExp(k, 'g')
      const hits = lower.match(re)?.length ?? 0
      score += Math.min(hits, 4)
    }
    if (score > bestScore) {
      bestScore = score
      best = t.id
    }
  }
  return bestScore >= 2 ? best : SITE_TYPE_FALLBACK.id
}

export function detectPricing(text: string): Pricing {
  const t = text.toLowerCase()
  const free = /\b(free|무료|open[- ]source|오픈소스)\b/.test(t)
  const paid = /\b(pricing|premium|pro plan|subscription|\$\d|₩[\d,]+|per month|\/mo\b|유료|구독|요금)/.test(t)
  if (free && paid) return 'freemium'
  if (free) return 'free'
  if (paid) return 'paid'
  return 'unknown'
}

function clean(s?: string) {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

export async function analyzeWebsite(input: string, onProgress?: (m: string) => void): Promise<WebAnalysis> {
  const u = normalizeUrl(input)
  if (!u) throw new Error('올바른 웹 주소가 아닙니다.')
  const url = u.toString()
  const domain = domainOf(u)
  const warnings: string[] = []

  onProgress?.('사이트 정보를 읽는 중…')
  const [ml, jina] = await Promise.all([viaMicrolink(url), viaJina(url)])
  const meta: Meta = { ...(jina ?? {}), ...(ml ?? {}) }
  if (jina?.content) meta.content = jina.content
  let fetchedWith: WebInfo['fetchedWith'] = ml ? 'microlink' : jina ? 'jina' : 'manual'
  if (!ml && !jina) {
    warnings.push('사이트 정보를 자동으로 읽지 못했습니다(차단 또는 로그인 필요). 이름과 설명을 직접 적어 주세요.')
    fetchedWith = 'manual'
  }

  const title = clean(meta.title) || domain
  const name = title.length > 80 ? title.slice(0, 79) + '…' : title
  const description = clean(meta.description) || clean(meta.content?.replace(/[#*>`\[\]()!-]/g, ' ').slice(0, 400)) || ''
  const content = (meta.content ?? '').slice(0, 20_000)
  const corpus = [domain, title, description, content.slice(0, 6000)].join('\n')
  const siteType = detectSiteType(domain, u.pathname, corpus)
  const pricing = detectPricing(corpus)

  const tags = new Set<string>()
  const st = SITE_TYPES.find((t) => t.id === siteType)
  if (st) tags.add(st.label)
  if (meta.lang && meta.lang !== 'en') tags.add(`lang:${meta.lang}`)
  if (meta.publisher && clean(meta.publisher).toLowerCase() !== domain) tags.add(clean(meta.publisher))

  return {
    name,
    description,
    content,
    tags: [...tags],
    warnings,
    web: {
      url,
      domain,
      favicon: faviconFor(domain),
      image: meta.image || meta.logo || undefined,
      siteType,
      pricing,
      publisher: clean(meta.publisher) || undefined,
      lang: meta.lang,
      fetchedWith,
    },
  }
}

/** Build the SavedSkill shell for a website so the shared UI (source/meta) keeps working. */
export function websiteShell(a: WebAnalysis, u: URL): Pick<SavedSkill, 'kind' | 'source' | 'resolvedRef' | 'meta' | 'dependencies' | 'install' | 'entryFiles' | 'files'> {
  const domain = domainOf(u)
  return {
    kind: 'website',
    source: { owner: domain, repo: '', path: u.pathname.replace(/^\/|\/$/g, ''), url: a.web.url },
    resolvedRef: '',
    meta: { fullName: domain, description: a.description || null, defaultBranch: '', stars: 0, license: null, homepage: a.web.url, language: null, topics: [], pushedAt: '' },
    dependencies: [],
    install: [
      { title: '바로 열기', note: a.web.url },
      { title: '북마크', note: '브라우저 북마크 바에 끌어다 놓거나, 이 카드에서 "열기"를 누르세요.' },
    ],
    entryFiles: [],
    files: [],
  }
}
