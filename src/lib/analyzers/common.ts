import YAML from 'yaml'
import type { Dependency, DependencyKind, FileEntry } from '../types'

export interface Ctx {
  owner: string
  repo: string
  ref: string
  /** scope directory inside repo, '' for root */
  base: string
  /** all repo files */
  allFiles: FileEntry[]
  /** files inside scope, with paths relative to `base` */
  files: FileEntry[]
  read: (relPath: string) => Promise<string | null>
  warnings: string[]
}

export function joinPath(base: string, rel: string) {
  return base ? `${base}/${rel}` : rel
}

export function hasFile(ctx: Ctx, rel: string) {
  return ctx.files.some((f) => f.type === 'blob' && f.path === rel)
}

export function listMatching(ctx: Ctx, re: RegExp) {
  return ctx.files.filter((f) => f.type === 'blob' && re.test(f.path)).map((f) => f.path)
}

export function parseFrontmatter(md: string): { data: Record<string, unknown>; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { data: {}, body: md }
  try {
    const data = (YAML.parse(m[1]) ?? {}) as Record<string, unknown>
    return { data: typeof data === 'object' ? data : {}, body: md.slice(m[0].length) }
  } catch {
    return { data: {}, body: md.slice(m[0].length) }
  }
}

export function firstParagraph(md: string, max = 240) {
  const body = md
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  const para = body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^#/.test(p) && !/^[-*>|`]/.test(p) && !/^\[!\[/.test(p) && p.length > 20)
  if (!para) return ''
  const s = para.replace(/\s+/g, ' ')
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export class DepSet {
  private map = new Map<string, Dependency>()
  add(name: string, kind: DependencyKind, detail?: string) {
    const n = name.trim()
    if (!n) return
    const key = `${kind}:${n.toLowerCase()}`
    const prev = this.map.get(key)
    if (prev) {
      if (detail && !prev.detail) prev.detail = detail
      return
    }
    this.map.set(key, { name: n, kind, detail })
  }
  list(): Dependency[] {
    const order: DependencyKind[] = ['runtime', 'tool', 'npm', 'pip', 'mcp', 'env', 'skill', 'other']
    return [...this.map.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name))
  }
}

const KNOWN_TOOLS: Record<string, string> = {
  ffmpeg: '영상/음성 처리 도구',
  pandoc: '문서 변환 도구',
  imagemagick: '이미지 처리 도구',
  magick: 'ImageMagick',
  libreoffice: 'LibreOffice (문서 변환)',
  soffice: 'LibreOffice (문서 변환)',
  playwright: '브라우저 자동화',
  puppeteer: '브라우저 자동화',
  chromium: '브라우저',
  docker: '컨테이너 런타임',
  gh: 'GitHub CLI',
  uv: 'Python 패키지 관리자 (uv)',
  uvx: 'uv 실행기',
  bun: 'Bun 런타임',
  deno: 'Deno 런타임',
  pnpm: 'pnpm',
  yarn: 'yarn',
  poetry: 'Poetry',
  jq: 'JSON 처리 도구',
  rg: 'ripgrep',
  ripgrep: 'ripgrep',
  tesseract: 'OCR 엔진',
  graphviz: '그래프 렌더링',
  dot: 'Graphviz',
  mermaid: 'Mermaid CLI',
  mmdc: 'Mermaid CLI',
  sqlite3: 'SQLite CLI',
  psql: 'PostgreSQL 클라이언트',
  kubectl: 'Kubernetes CLI',
  terraform: 'Terraform',
  aws: 'AWS CLI',
  gcloud: 'Google Cloud CLI',
  az: 'Azure CLI',
  vercel: 'Vercel CLI',
  netlify: 'Netlify CLI',
  wrangler: 'Cloudflare Wrangler',
  supabase: 'Supabase CLI',
  stripe: 'Stripe CLI',
  xcodebuild: 'Xcode',
  gradle: 'Gradle',
  cargo: 'Rust Cargo',
  go: 'Go 런타임',
}

const IGNORED_ENV = new Set([
  'PATH',
  'HOME',
  'PWD',
  'SHELL',
  'USER',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'TERM',
  'EDITOR',
  'PORT',
  'HOST',
  'NODE_ENV',
  'CI',
  'DEBUG',
  'ARGUMENTS',
  'CLAUDE_PROJECT_DIR',
  'CLAUDE_PLUGIN_ROOT',
  'CLAUDE_CODE_REMOTE',
  'CLAUDE_ENV_FILE',
  'CLAUDE_SKILL_DIR',
  'CLAUDE_SESSION_ID',
  'CLAUDE_TOOL_INPUT',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'XDG_CONFIG_HOME',
  'README',
  'TODO',
  'NOTE',
  'WARNING',
  'IMPORTANT',
])

/** Scan free text (markdown, shell, scripts) for install commands, tools and env vars. */
export function scanText(text: string, deps: DepSet, source: string) {
  const code = text
  for (const m of code.matchAll(/\bpip3?\s+install\s+(?:-[-\w]+\s+)*([^\n`|&;]+)/g)) {
    for (const p of m[1].split(/\s+/)) {
      if (!p || p.startsWith('-') || p === '.' || p.startsWith('.') || p.startsWith('/')) continue
      deps.add(p.replace(/[>=<~!].*$/, '').replace(/\[.*$/, ''), 'pip', source)
    }
  }
  for (const m of code.matchAll(/\buv\s+(?:pip\s+install|add)\s+(?:-[-\w]+\s+)*([^\n`|&;]+)/g)) {
    for (const p of m[1].split(/\s+/)) if (p && !p.startsWith('-')) deps.add(p.replace(/[>=<~!].*$/, ''), 'pip', source)
  }
  for (const m of code.matchAll(/\b(?:npm\s+(?:install|i|add)|pnpm\s+(?:add|install)|yarn\s+add|bun\s+add)\s+(?:-[-\w]+\s+)*([^\n`|&;]+)/g)) {
    for (const p of m[1].split(/\s+/)) {
      if (!p || p.startsWith('-') || p === '.' || p.startsWith('./')) continue
      deps.add(p.replace(/(?!^)@.*$/, ''), 'npm', source)
    }
  }
  for (const m of code.matchAll(/\b(?:npx|bunx)\s+(?:-y\s+|--yes\s+)?(@?[\w.-]+(?:\/[\w.-]+)?)/g)) {
    const p = m[1]
    if (p && !/^(degit|create|-)/.test(p)) deps.add(p.replace(/(?!^)@.*$/, ''), 'npm', `${source} (npx)`)
  }
  for (const m of code.matchAll(/\buvx\s+(?:--from\s+\S+\s+)?([\w.-]+)/g)) deps.add(m[1], 'pip', `${source} (uvx)`)
  for (const m of code.matchAll(/\b(?:brew|apt(?:-get)?|choco|winget|scoop)\s+install\s+(?:-[-\w]+\s+)*([^\n`|&;]+)/g)) {
    for (const p of m[1].split(/\s+/)) if (p && !p.startsWith('-')) deps.add(p, 'tool', `${source} (시스템 패키지)`)
  }
  const lower = code.toLowerCase()
  for (const [tool, label] of Object.entries(KNOWN_TOOLS)) {
    const re = new RegExp(`(^|[\\s\`"'(/])${tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\`"')]|$)`, 'm')
    if (re.test(lower)) deps.add(tool, 'tool', label)
  }
  for (const m of code.matchAll(/(?:\$\{?|process\.env\.|os\.environ(?:\.get)?\(?\[?['"]?|os\.getenv\(['"]|getenv\(['"])([A-Z][A-Z0-9_]{3,})/g)) {
    const v = m[1]
    if (IGNORED_ENV.has(v)) continue
    if (/^(?:KEY|TOKEN|SECRET|PASSWORD|API|ID|URL|HOST|PATH)$/.test(v)) continue
    deps.add(v, 'env', /KEY|TOKEN|SECRET|PASSWORD/.test(v) ? '비밀값, 직접 발급 필요' : '환경 변수')
  }
}

const PY_STDLIB = new Set(
  'os sys re json time datetime pathlib typing subprocess shutil argparse logging collections itertools functools math random string io csv base64 hashlib hmac urllib http socket ssl threading multiprocessing asyncio concurrent dataclasses enum abc copy pprint textwrap unicodedata glob fnmatch tempfile zipfile tarfile gzip struct statistics decimal fractions uuid secrets getpass platform signal traceback warnings contextlib inspect importlib pkgutil ast dis tokenize sqlite3 xml html email mimetypes webbrowser configparser codecs locale calendar heapq bisect array queue weakref types operator numbers cmath difflib shlex select selectors errno stat filecmp linecache pickle shelve dbm'.split(
    ' ',
  ),
)

export function scanPythonImports(code: string, deps: DepSet, source: string) {
  for (const m of code.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)) {
    const mod = (m[1] ?? m[2]).split('.')[0]
    if (!mod || PY_STDLIB.has(mod) || mod.startsWith('_')) continue
    deps.add(mod, 'pip', `${source} 에서 import`)
  }
}

export function scanNodeImports(code: string, deps: DepSet, source: string) {
  for (const m of code.matchAll(/(?:from\s+|require\()\s*['"]((?:@[\w.-]+\/)?[\w.-]+)(?:\/[^'"]*)?['"]/g)) {
    const mod = m[1]
    if (mod.startsWith('.') || mod.startsWith('node:')) continue
    if (/^(fs|path|os|url|http|https|child_process|crypto|util|stream|events|readline|zlib|buffer|assert|process)$/.test(mod)) continue
    deps.add(mod, 'npm', `${source} 에서 import`)
  }
}

export function parseRequirements(text: string, deps: DepSet, source: string) {
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim()
    if (!l || l.startsWith('#') || l.startsWith('-')) continue
    const name = l.split(/[<>=!~;\[ ]/)[0]
    if (name) deps.add(name, 'pip', source)
  }
}

export function parsePyproject(text: string, deps: DepSet, source: string): { name?: string; description?: string } {
  const out: { name?: string; description?: string } = {}
  const name = text.match(/^\s*name\s*=\s*["']([^"']+)["']/m)
  const desc = text.match(/^\s*description\s*=\s*["']([^"']+)["']/m)
  if (name) out.name = name[1]
  if (desc) out.description = desc[1]
  const block = text.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m)
  if (block) {
    for (const m of block[1].matchAll(/["']([^"']+)["']/g)) {
      const n = m[1].split(/[<>=!~;\[ ]/)[0]
      if (n) deps.add(n, 'pip', source)
    }
  }
  const req = text.match(/requires-python\s*=\s*["']([^"']+)["']/)
  if (req) deps.add('python', 'runtime', `Python ${req[1]}`)
  return out
}

export interface PackageJson {
  name?: string
  description?: string
  version?: string
  bin?: string | Record<string, string>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  engines?: Record<string, string>
  keywords?: string[]
  mcpName?: string
}

export function parsePackageJson(text: string, deps: DepSet, source: string): PackageJson | null {
  try {
    const pkg = JSON.parse(text) as PackageJson
    for (const [n, v] of Object.entries(pkg.dependencies ?? {})) deps.add(n, 'npm', `${source} ${v}`)
    for (const [n, v] of Object.entries(pkg.peerDependencies ?? {})) deps.add(n, 'npm', `${source} peer ${v}`)
    if (pkg.engines?.node) deps.add('node', 'runtime', `Node ${pkg.engines.node}`)
    else deps.add('node', 'runtime', 'Node.js')
    return pkg
  } catch {
    return null
  }
}

export function formatBytes(n?: number) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
