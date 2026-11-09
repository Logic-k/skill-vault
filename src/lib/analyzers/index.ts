import { fetchRepoMeta, fetchText, fetchTree, GitHubError } from '../github'
import type { FileEntry, RepoMeta, RepoRef, SkillAnalysis } from '../types'
import type { Ctx } from './common'
import { DETECTORS } from './detectors'

export interface AnalyzeResult {
  analysis: SkillAnalysis
  meta: RepoMeta
  resolvedRef: string
  source: RepoRef
}

const IGNORED_DIRS = /(^|\/)(node_modules|\.git|dist|build|__pycache__|\.venv|venv|\.next|coverage)(\/|$)/

export async function analyzeRepo(source: RepoRef, onProgress?: (msg: string) => void): Promise<AnalyzeResult> {
  onProgress?.('저장소 정보를 읽는 중…')
  const meta = await fetchRepoMeta(source.owner, source.repo)

  onProgress?.('파일 목록을 가져오는 중…')
  let ref = source.ref ?? meta.defaultBranch
  let path = source.path
  let tree: { files: FileEntry[]; truncated: boolean } | null = null
  // Branch names may contain '/', so try progressively longer refs until the tree resolves.
  const segs = source.path.split('/').filter(Boolean)
  for (let i = 0; i <= segs.length; i++) {
    const tryRef = i === 0 ? ref : `${source.ref}/${segs.slice(0, i).join('/')}`
    const tryPath = segs.slice(i).join('/')
    try {
      tree = await fetchTree(source.owner, source.repo, tryRef)
      ref = tryRef
      path = tryPath
      break
    } catch (e) {
      if (!(e instanceof GitHubError && e.status === 404) || !source.ref || i === segs.length) throw e
    }
  }
  if (!tree) throw new GitHubError('파일 트리를 가져오지 못했습니다.', 500)

  const all = tree.files.filter((f) => !IGNORED_DIRS.test(f.path))
  if (path && !all.some((f) => f.path === path || f.path.startsWith(path + '/'))) {
    throw new GitHubError(`경로를 찾을 수 없습니다: ${path}`, 404)
  }
  const prefix = path ? path + '/' : ''
  const scoped = all
    .filter((f) => !path || f.path.startsWith(prefix))
    .map((f) => ({ ...f, path: f.path.slice(prefix.length) }))
    .filter((f) => f.path)

  const warnings: string[] = []
  if (tree.truncated) warnings.push('저장소가 너무 커서 파일 목록 일부가 잘렸습니다.')

  const cache = new Map<string, Promise<string | null>>()
  const read = (rel: string) => {
    const full = prefix + rel
    let p = cache.get(full)
    if (!p) {
      p = fetchText(source.owner, source.repo, ref, full).catch(() => null)
      cache.set(full, p)
    }
    return p
  }

  const ctx: Ctx = { owner: source.owner, repo: source.repo, ref, base: path, allFiles: all, files: scoped, read, warnings }

  for (const d of DETECTORS) {
    onProgress?.(`분석 중… (${d.id})`)
    const result = await d.detect(ctx)
    if (result) {
      return { analysis: result, meta, resolvedRef: ref, source: { ...source, path, ref: source.ref } }
    }
  }
  throw new GitHubError('분석할 수 있는 내용을 찾지 못했습니다.', 422)
}
