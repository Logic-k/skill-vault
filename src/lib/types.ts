export type SkillKind =
  | 'claude-skill'
  | 'skill-collection'
  | 'claude-plugin'
  | 'claude-marketplace'
  | 'mcp-server'
  | 'npm-package'
  | 'python-package'
  | 'repo'
  | 'website'

export const KIND_LABEL: Record<SkillKind, string> = {
  'claude-skill': 'Claude 스킬',
  'skill-collection': '스킬 모음',
  'claude-plugin': 'Claude 플러그인',
  'claude-marketplace': '플러그인 마켓플레이스',
  'mcp-server': 'MCP 서버',
  'npm-package': 'npm 패키지',
  'python-package': 'Python 패키지',
  repo: '일반 저장소',
  website: 'AI 웹사이트',
}

export type Pricing = 'free' | 'freemium' | 'paid' | 'unknown'
export const PRICING_LABEL: Record<Pricing, string> = { free: '무료', freemium: '부분 무료', paid: '유료', unknown: '가격 미확인' }

/** Extra fields for kind === 'website'. `source`/`meta` are filled with the domain so the rest of the UI keeps working. */
export interface WebInfo {
  url: string
  domain: string
  favicon: string
  image?: string
  siteType: string
  pricing: Pricing
  publisher?: string
  lang?: string
  fetchedWith?: 'microlink' | 'jina' | 'manual'
}

export interface SiteTypeRule {
  id: string
  label: string
  icon: string
  keywords: string[]
  domains?: string[]
}

export interface RepoRef {
  owner: string
  repo: string
  /** branch, tag or commit; undefined = default branch */
  ref?: string
  /** sub-directory inside the repo, empty string = root */
  path: string
  url: string
}

export interface FileEntry {
  path: string
  type: 'blob' | 'tree'
  size?: number
}

export type DependencyKind = 'npm' | 'pip' | 'tool' | 'env' | 'mcp' | 'skill' | 'runtime' | 'other'

export interface Dependency {
  name: string
  kind: DependencyKind
  detail?: string
}

export interface InstallStep {
  title: string
  command?: string
  note?: string
}

export interface SubItem {
  name: string
  path: string
  description?: string
  kind: SkillKind
}

export interface SkillAnalysis {
  kind: SkillKind
  name: string
  description: string
  dependencies: Dependency[]
  install: InstallStep[]
  entryFiles: string[]
  tags: string[]
  frontmatter?: Record<string, unknown>
  readme?: string
  skillMd?: string
  subItems?: SubItem[]
  files: FileEntry[]
  warnings: string[]
}

export interface RepoMeta {
  fullName: string
  description: string | null
  defaultBranch: string
  stars: number
  license: string | null
  homepage: string | null
  language: string | null
  topics: string[]
  pushedAt: string
}

export interface SavedSkill extends SkillAnalysis {
  id: string
  source: RepoRef
  /** resolved ref actually analyzed (branch name or commit) */
  resolvedRef: string
  meta: RepoMeta
  /** automatically assigned categories */
  categories: string[]
  /** user-chosen categories; when present they override `categories` in the UI */
  manualCategories?: string[]
  note?: string
  /** want = 아직 안 써봄, using = 사용 중, archived = 보관 */
  status?: 'want' | 'using' | 'archived'
  /** undefined = 예시 목록처럼 아직 GitHub에서 분석하지 않은 항목 */
  analyzedAt?: string
  addedAt: string
  web?: WebInfo
}

export interface CategoryRule {
  id: string
  label: string
  keywords: string[]
  builtin?: boolean
}

export interface Settings {
  token: string
  customCategories: CategoryRule[]
}
