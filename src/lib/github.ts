import type { FileEntry, RepoMeta, RepoRef } from './types'

const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'

let tokenProvider: () => string = () => ''
export function setTokenProvider(fn: () => string) {
  tokenProvider = fn
}

export class GitHubError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' }
  const t = tokenProvider().trim()
  if (t) h.Authorization = `Bearer ${t}`
  return h
}

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    if (res.status === 403 && remaining === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000
      const mins = Math.max(1, Math.round((reset - Date.now()) / 60000))
      throw new GitHubError(
        `GitHub API 요청 한도에 걸렸습니다 (약 ${mins}분 후 초기화). 설정에서 개인 토큰을 넣으면 한도가 시간당 60회에서 5000회로 늘어납니다.`,
        429,
      )
    }
    if (res.status === 404) {
      throw new GitHubError('저장소나 경로를 찾을 수 없습니다. 비공개 저장소라면 설정에서 토큰을 넣어 주세요.', 404)
    }
    throw new GitHubError(`GitHub API 오류 ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

/**
 * Accepts:
 *  - https://github.com/owner/repo
 *  - https://github.com/owner/repo/tree/<ref>/sub/dir
 *  - https://github.com/owner/repo/blob/<ref>/sub/dir/SKILL.md
 *  - git@github.com:owner/repo.git
 *  - owner/repo  or  owner/repo/sub/dir
 */
export function parseGitHubUrl(input: string): RepoRef | null {
  let s = input.trim()
  if (!s) return null
  s = s.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git(\/|$)/, '$1')
  if (!/^https?:\/\//.test(s)) {
    if (/^[\w.-]+\/[\w.-]+/.test(s)) s = 'https://github.com/' + s
    else return null
  }
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (!/(^|\.)github\.com$/.test(u.hostname)) return null
  const parts = u.pathname.split('/').filter(Boolean)
  if (parts.length < 2) return null
  const [owner, repo] = parts
  let ref: string | undefined
  let pathParts: string[] = []
  if (parts.length > 2) {
    if (parts[2] === 'tree' || parts[2] === 'blob') {
      ref = parts[3]
      pathParts = parts.slice(4)
      if (parts[2] === 'blob') pathParts = pathParts.slice(0, -1)
    } else {
      pathParts = parts.slice(2)
    }
  }
  return {
    owner,
    repo,
    ref,
    path: pathParts.map(decodeURIComponent).join('/'),
    url: `https://github.com/${owner}/${repo}`,
  }
}

export async function fetchRepoMeta(owner: string, repo: string): Promise<RepoMeta> {
  const r = await api<{
    full_name: string
    description: string | null
    default_branch: string
    stargazers_count: number
    license: { spdx_id: string } | null
    homepage: string | null
    language: string | null
    topics?: string[]
    pushed_at: string
  }>(`${API}/repos/${owner}/${repo}`)
  return {
    fullName: r.full_name,
    description: r.description,
    defaultBranch: r.default_branch,
    stars: r.stargazers_count,
    license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : null,
    homepage: r.homepage,
    language: r.language,
    topics: r.topics ?? [],
    pushedAt: r.pushed_at,
  }
}

export async function fetchTree(
  owner: string,
  repo: string,
  ref: string,
): Promise<{ files: FileEntry[]; truncated: boolean }> {
  const r = await api<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
    `${API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
  )
  return {
    files: r.tree.map((t) => ({ path: t.path, type: t.type === 'tree' ? 'tree' : 'blob', size: t.size })),
    truncated: r.truncated,
  }
}

function rawUrl(owner: string, repo: string, ref: string, path: string) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `${RAW}/${owner}/${repo}/${encodeURIComponent(ref)}/${encodedPath}`
}

/** Fetch a text file. Uses raw.githubusercontent.com (no API rate limit) and falls back to the API when a token is set. */
export async function fetchText(owner: string, repo: string, ref: string, path: string): Promise<string> {
  const res = await fetch(rawUrl(owner, repo, ref, path))
  if (res.ok) return res.text()
  if (!tokenProvider().trim()) throw new GitHubError(`파일을 읽을 수 없습니다: ${path}`, res.status)
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const r = await api<{ content: string; encoding: string }>(
    `${API}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
  )
  const bin = atob(r.content.replace(/\n/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export async function fetchBinary(owner: string, repo: string, ref: string, path: string): Promise<Uint8Array> {
  const res = await fetch(rawUrl(owner, repo, ref, path))
  if (!res.ok) throw new GitHubError(`파일을 내려받을 수 없습니다: ${path}`, res.status)
  return new Uint8Array(await res.arrayBuffer())
}
