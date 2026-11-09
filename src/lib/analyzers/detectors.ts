import type { InstallStep, SkillAnalysis, SubItem } from '../types'
import {
  DepSet,
  firstParagraph,
  hasFile,
  joinPath,
  listMatching,
  parseFrontmatter,
  parsePackageJson,
  parsePyproject,
  parseRequirements,
  scanNodeImports,
  scanPythonImports,
  scanText,
  type Ctx,
} from './common'

/**
 * A detector looks at the scoped file list and returns an analysis when it recognises the layout.
 * Detectors run in order; the first match wins. Add a new entry to DETECTORS to support a new kind.
 */
export interface Detector {
  id: string
  detect: (ctx: Ctx) => Promise<SkillAnalysis | null>
}

type Partial_ = Omit<SkillAnalysis, 'files' | 'warnings'>

function sourceSpec(ctx: Ctx) {
  const sub = ctx.base ? `/${ctx.base}` : ''
  return `${ctx.owner}/${ctx.repo}${sub}#${ctx.ref}`
}

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill'
  )
}

async function readMany(ctx: Ctx, paths: string[], limit = 25, maxSize = 200_000) {
  const out: { path: string; text: string }[] = []
  const chosen = paths
    .map((p) => ctx.files.find((f) => f.path === p))
    .filter((f): f is NonNullable<typeof f> => !!f && (f.size ?? 0) <= maxSize)
    .slice(0, limit)
  await Promise.all(
    chosen.map(async (f) => {
      const t = await ctx.read(f.path)
      if (t != null) out.push({ path: f.path, text: t })
    }),
  )
  if (paths.length > limit) ctx.warnings.push(`스크립트 파일이 ${paths.length}개라 처음 ${limit}개만 의존성 검사를 했습니다.`)
  return out
}

/** Scan the usual script locations for runtime deps. */
async function scanScripts(ctx: Ctx, deps: DepSet) {
  const scripts = listMatching(ctx, /\.(py|sh|bash|zsh|js|mjs|cjs|ts)$/i).filter((p) => !/node_modules|\/dist\/|\/build\//.test(p))
  const read = await readMany(ctx, scripts)
  for (const { path, text } of read) {
    scanText(text, deps, path)
    if (/\.py$/i.test(path)) {
      deps.add('python', 'runtime', 'Python 스크립트 포함')
      scanPythonImports(text, deps, path)
    }
    if (/\.(js|mjs|cjs|ts)$/i.test(path)) {
      deps.add('node', 'runtime', 'JS/TS 스크립트 포함')
      scanNodeImports(text, deps, path)
    }
    if (/\.(sh|bash|zsh)$/i.test(path)) deps.add('bash', 'runtime', '셸 스크립트 포함')
  }
  for (const req of listMatching(ctx, /(^|\/)requirements[\w-]*\.txt$/)) {
    const t = await ctx.read(req)
    if (t) parseRequirements(t, deps, req)
  }
  for (const pp of listMatching(ctx, /(^|\/)pyproject\.toml$/)) {
    const t = await ctx.read(pp)
    if (t) parsePyproject(t, deps, pp)
  }
  for (const pj of listMatching(ctx, /(^|\/)package\.json$/).filter((p) => !p.includes('node_modules'))) {
    const t = await ctx.read(pj)
    if (t) parsePackageJson(t, deps, pj)
  }
}

async function readReadme(ctx: Ctx) {
  const r = ctx.files.find((f) => f.type === 'blob' && /^readme(\.md|\.markdown|\.rst|\.txt)?$/i.test(f.path))
  return r ? await ctx.read(r.path) : null
}

function skillInstallSteps(ctx: Ctx, name: string): InstallStep[] {
  const spec = sourceSpec(ctx)
  return [
    {
      title: '개인 스킬로 설치 (모든 프로젝트에서 사용)',
      command: `npx degit ${spec} ~/.claude/skills/${name}`,
      note: 'degit은 저장소의 하위 폴더만 git 기록 없이 내려받습니다. 설치 뒤 Claude Code를 재시작하면 바로 인식됩니다.',
    },
    {
      title: '현재 프로젝트에만 설치',
      command: `npx degit ${spec} .claude/skills/${name}`,
    },
    {
      title: '수동 설치',
      note: '아래 "ZIP 내려받기"로 받은 폴더를 ~/.claude/skills/ 아래에 두면 됩니다. 폴더 안에 SKILL.md가 바로 있어야 합니다.',
    },
  ]
}

const claudeSkill: Detector = {
  id: 'claude-skill',
  async detect(ctx) {
    if (!hasFile(ctx, 'SKILL.md')) return null
    const md = (await ctx.read('SKILL.md')) ?? ''
    const { data, body } = parseFrontmatter(md)
    const fmName = typeof data.name === 'string' ? data.name : undefined
    const fmDesc = typeof data.description === 'string' ? data.description : undefined
    const folderName = ctx.base.split('/').pop() || ctx.repo
    const name = fmName || folderName
    const deps = new DepSet()
    scanText(md, deps, 'SKILL.md')
    await scanScripts(ctx, deps)
    if (Array.isArray(data['allowed-tools'])) {
      for (const t of data['allowed-tools'] as unknown[]) if (typeof t === 'string') deps.add(t, 'other', '허용 도구 (allowed-tools)')
    } else if (typeof data['allowed-tools'] === 'string') {
      for (const t of data['allowed-tools'].split(/[\s,]+/)) if (t) deps.add(t, 'other', '허용 도구 (allowed-tools)')
    }
    const refs = listMatching(ctx, /^(references?|reference|docs?)\/.+\.md$/i)
    const scripts = listMatching(ctx, /^scripts?\/.+/i)
    const assets = listMatching(ctx, /^(assets?|templates?)\/.+/i)
    const tags = new Set<string>()
    if (scripts.length) tags.add('scripts')
    if (refs.length) tags.add('references')
    if (assets.length) tags.add('assets')
    const readme = await readReadme(ctx)
    const out: Partial_ = {
      kind: 'claude-skill',
      name,
      description: fmDesc || firstParagraph(body) || firstParagraph(readme ?? '') || '설명이 없습니다.',
      dependencies: deps.list(),
      install: skillInstallSteps(ctx, slug(name)),
      entryFiles: ['SKILL.md', ...refs.slice(0, 10), ...scripts.slice(0, 10)],
      tags: [...tags],
      frontmatter: data,
      skillMd: md,
      readme: readme ?? undefined,
    }
    return { ...out, files: ctx.files, warnings: ctx.warnings }
  },
}

async function collectSubSkills(ctx: Ctx): Promise<SubItem[]> {
  const skillFiles = listMatching(ctx, /(^|\/)SKILL\.md$/).filter((p) => p !== 'SKILL.md')
  const items: SubItem[] = []
  const chosen = skillFiles.slice(0, 60)
  if (skillFiles.length > chosen.length) ctx.warnings.push(`하위 스킬이 ${skillFiles.length}개라 처음 ${chosen.length}개만 읽었습니다.`)
  await Promise.all(
    chosen.map(async (p) => {
      const dir = p.replace(/\/?SKILL\.md$/, '')
      const md = await ctx.read(p)
      const fm = md ? parseFrontmatter(md).data : {}
      items.push({
        name: (typeof fm.name === 'string' && fm.name) || dir.split('/').pop() || dir,
        path: joinPath(ctx.base, dir),
        description: typeof fm.description === 'string' ? fm.description : md ? firstParagraph(md, 160) : undefined,
        kind: 'claude-skill',
      })
    }),
  )
  return items.sort((a, b) => a.path.localeCompare(b.path))
}

const claudePlugin: Detector = {
  id: 'claude-plugin',
  async detect(ctx) {
    const isMarketplace = hasFile(ctx, '.claude-plugin/marketplace.json')
    const isPlugin = hasFile(ctx, '.claude-plugin/plugin.json')
    if (!isMarketplace && !isPlugin) return null
    const deps = new DepSet()
    const readme = await readReadme(ctx)
    const subItems: SubItem[] = []
    let name = ctx.base.split('/').pop() || ctx.repo
    let description = ''
    const install: InstallStep[] = []
    const entry: string[] = []
    const tags = new Set<string>()

    if (isMarketplace) {
      const raw = await ctx.read('.claude-plugin/marketplace.json')
      entry.push('.claude-plugin/marketplace.json')
      try {
        const mp = JSON.parse(raw ?? '{}') as {
          name?: string
          description?: string
          plugins?: { name: string; description?: string; source?: unknown }[]
        }
        name = mp.name || name
        description = mp.description || ''
        for (const p of mp.plugins ?? []) {
          const src = p.source
          const localPath = typeof src === 'string' && src.startsWith('./') ? joinPath(ctx.base, src.slice(2)) : undefined
          subItems.push({ name: p.name, description: p.description, path: localPath ?? '', kind: 'claude-plugin' })
        }
        install.push(
          {
            title: '마켓플레이스 등록',
            command: `/plugin marketplace add ${ctx.owner}/${ctx.repo}`,
            note: 'Claude Code 안에서 실행합니다.',
          },
          {
            title: '플러그인 설치',
            command: `/plugin install <플러그인이름>@${name}`,
            note: `아래 목록의 플러그인 이름을 넣으세요. (${(mp.plugins ?? []).length}개 포함)`,
          },
        )
      } catch {
        ctx.warnings.push('marketplace.json을 해석하지 못했습니다.')
      }
      tags.add('marketplace')
    }

    if (isPlugin) {
      const raw = await ctx.read('.claude-plugin/plugin.json')
      entry.push('.claude-plugin/plugin.json')
      try {
        const pj = JSON.parse(raw ?? '{}') as { name?: string; description?: string; version?: string; keywords?: string[] }
        if (!isMarketplace) {
          name = pj.name || name
          description = pj.description || ''
        }
        for (const k of pj.keywords ?? []) tags.add(k)
      } catch {
        ctx.warnings.push('plugin.json을 해석하지 못했습니다.')
      }
      const cmds = listMatching(ctx, /^commands\/.+\.md$/)
      const agents = listMatching(ctx, /^agents\/.+\.md$/)
      const skills = listMatching(ctx, /^skills\/[^/]+\/SKILL\.md$/)
      const hooks = listMatching(ctx, /^hooks\/.+/)
      if (cmds.length) tags.add(`commands:${cmds.length}`)
      if (agents.length) tags.add(`agents:${agents.length}`)
      if (skills.length) tags.add(`skills:${skills.length}`)
      if (hooks.length) tags.add('hooks')
      entry.push(...cmds.slice(0, 8), ...agents.slice(0, 8), ...skills.slice(0, 8))
      if (hasFile(ctx, '.mcp.json')) {
        entry.push('.mcp.json')
        try {
          const mcp = JSON.parse((await ctx.read('.mcp.json')) ?? '{}') as { mcpServers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }> }
          for (const [n, s] of Object.entries(mcp.mcpServers ?? {})) {
            deps.add(n, 'mcp', [s.command, ...(s.args ?? [])].filter(Boolean).join(' '))
            for (const e of Object.keys(s.env ?? {})) deps.add(e, 'env', `MCP 서버 ${n} 환경 변수`)
          }
        } catch {
          ctx.warnings.push('.mcp.json을 해석하지 못했습니다.')
        }
      }
      for (const sk of skills) subItems.push({ name: sk.split('/')[1], path: joinPath(ctx.base, sk.replace(/\/SKILL\.md$/, '')), kind: 'claude-skill' })
      if (!isMarketplace) {
        install.push(
          {
            title: '로컬에 받아서 바로 써보기',
            command: `npx degit ${sourceSpec(ctx)} ./${slug(name)} && claude --plugin-dir ./${slug(name)}`,
            note: '세션 동안만 플러그인이 로드됩니다.',
          },
          {
            title: '영구 설치 (마켓플레이스 경유)',
            note: '이 저장소가 어떤 마켓플레이스에 등록되어 있다면 그곳에서 /plugin install 로 설치하세요. 독립 플러그인은 자기 마켓플레이스를 만들어 등록할 수 있습니다.',
          },
        )
      }
    }

    await scanScripts(ctx, deps)
    if (readme) scanText(readme, deps, 'README')
    const out: Partial_ = {
      kind: isMarketplace ? 'claude-marketplace' : 'claude-plugin',
      name,
      description: description || firstParagraph(readme ?? '') || '설명이 없습니다.',
      dependencies: deps.list(),
      install,
      entryFiles: entry,
      tags: [...tags],
      readme: readme ?? undefined,
      subItems,
    }
    return { ...out, files: ctx.files, warnings: ctx.warnings }
  },
}

const skillCollection: Detector = {
  id: 'skill-collection',
  async detect(ctx) {
    const skillFiles = listMatching(ctx, /(^|\/)SKILL\.md$/)
    if (skillFiles.length < 1 || hasFile(ctx, 'SKILL.md')) return null
    const subItems = await collectSubSkills(ctx)
    const readme = await readReadme(ctx)
    const deps = new DepSet()
    if (readme) scanText(readme, deps, 'README')
    const spec = sourceSpec(ctx)
    const commonDir = commonPrefix(subItems.map((s) => s.path.slice(ctx.base ? ctx.base.length + 1 : 0)))
    const out: Partial_ = {
      kind: 'skill-collection',
      name: ctx.base.split('/').pop() || ctx.repo,
      description: firstParagraph(readme ?? '') || `${subItems.length}개의 스킬이 들어 있는 모음입니다.`,
      dependencies: deps.list(),
      install: [
        {
          title: '하위 스킬을 하나씩 가져오기',
          note: '아래 목록에서 원하는 스킬의 "분석" 버튼을 누르면 그 스킬만 따로 가져올 수 있습니다.',
        },
        {
          title: '모음 전체를 개인 스킬 폴더에 설치',
          command: `npx degit ${spec}${commonDir ? '/' + commonDir : ''} ~/.claude/skills/${slug(ctx.base.split('/').pop() || ctx.repo)}`,
          note: '모음 안의 스킬 폴더 구조가 그대로 들어갑니다. 하위 폴더에 SKILL.md가 있으면 Claude Code가 재귀적으로 찾지 않을 수 있으니 폴더별로 옮기는 편이 안전합니다.',
        },
      ],
      entryFiles: skillFiles.slice(0, 20),
      tags: [`skills:${subItems.length}`],
      readme: readme ?? undefined,
      subItems,
    }
    return { ...out, files: ctx.files, warnings: ctx.warnings }
  },
}

function commonPrefix(paths: string[]) {
  if (!paths.length) return ''
  const parts = paths.map((p) => p.split('/').slice(0, -1))
  const first = parts[0]
  const out: string[] = []
  for (let i = 0; i < first.length; i++) {
    if (parts.every((p) => p[i] === first[i])) out.push(first[i])
    else break
  }
  return out.join('/')
}

const mcpServer: Detector = {
  id: 'mcp-server',
  async detect(ctx) {
    const deps = new DepSet()
    let name = ctx.base.split('/').pop() || ctx.repo
    let description = ''
    let isMcp = false
    const install: InstallStep[] = []
    const entry: string[] = []
    const readme = await readReadme(ctx)
    if (hasFile(ctx, 'package.json')) {
      const pkg = parsePackageJson((await ctx.read('package.json')) ?? '', deps, 'package.json')
      if (pkg) {
        const all = { ...pkg.dependencies, ...pkg.peerDependencies }
        if (Object.keys(all).some((d) => d.startsWith('@modelcontextprotocol/')) || pkg.mcpName || /mcp[-_ ]?server/i.test(pkg.name ?? '')) {
          isMcp = true
          name = pkg.name || name
          description = pkg.description || ''
          entry.push('package.json')
          const runnable = !!pkg.bin && pkg.name
          install.push({
            title: 'Claude Code에 MCP 서버 등록 (npm 배포본)',
            command: runnable
              ? `claude mcp add ${slug(pkg.name!.split('/').pop()!)} -- npx -y ${pkg.name}`
              : `claude mcp add ${slug(name)} -- node <빌드된 진입 파일 경로>`,
            note: runnable ? 'npm에 배포된 패키지라면 이 명령 하나로 끝납니다.' : 'bin 항목이 없어 저장소를 클론해 빌드한 뒤 등록해야 합니다.',
          })
        }
      }
    }
    if (!isMcp && hasFile(ctx, 'pyproject.toml')) {
      const t = (await ctx.read('pyproject.toml')) ?? ''
      const info = parsePyproject(t, deps, 'pyproject.toml')
      if (/["'](mcp|fastmcp)[\[>=<"']/.test(t) || /mcp/i.test(info.name ?? '')) {
        isMcp = true
        name = info.name || name
        description = info.description || ''
        entry.push('pyproject.toml')
        install.push({
          title: 'Claude Code에 MCP 서버 등록 (Python)',
          command: `claude mcp add ${slug(name)} -- uvx ${name}`,
          note: 'PyPI에 배포되어 있을 때 동작합니다. 아니면 클론 후 `uv run` 으로 실행 경로를 지정하세요.',
        })
      }
    }
    if (!isMcp && readme && /model context protocol|mcp server|mcpServers/i.test(readme)) {
      isMcp = true
      entry.push('README')
      install.push({ title: 'README의 설정 예시를 따르세요', note: 'README에 mcpServers 설정 예시가 있습니다. 미리보기에서 확인하세요.' })
    }
    if (!isMcp) return null
    install.push({
      title: '설정 파일에 직접 추가',
      command: `{\n  "mcpServers": {\n    "${slug(name)}": { "command": "npx", "args": ["-y", "${name}"] }\n  }\n}`,
      note: '~/.claude.json 또는 프로젝트 .mcp.json 에 넣습니다. 명령과 인자는 README 기준으로 맞춰 주세요.',
    })
    await scanScripts(ctx, deps)
    if (readme) scanText(readme, deps, 'README')
    const out: Partial_ = {
      kind: 'mcp-server',
      name,
      description: description || firstParagraph(readme ?? '') || '설명이 없습니다.',
      dependencies: deps.list(),
      install,
      entryFiles: entry,
      tags: ['mcp'],
      readme: readme ?? undefined,
    }
    return { ...out, files: ctx.files, warnings: ctx.warnings }
  },
}

const npmPackage: Detector = {
  id: 'npm-package',
  async detect(ctx) {
    if (!hasFile(ctx, 'package.json')) return null
    const deps = new DepSet()
    const pkg = parsePackageJson((await ctx.read('package.json')) ?? '', deps, 'package.json')
    if (!pkg) return null
    const readme = await readReadme(ctx)
    if (readme) scanText(readme, deps, 'README')
    const name = pkg.name || ctx.repo
    const install: InstallStep[] = pkg.bin
      ? [
          { title: '바로 실행', command: `npx ${name}` },
          { title: '전역 설치', command: `npm install -g ${name}` },
        ]
      : [
          { title: '프로젝트에 추가', command: `npm install ${name}` },
          { title: '소스 받기', command: `git clone https://github.com/${ctx.owner}/${ctx.repo}.git` },
        ]
    const out: Partial_ = {
      kind: 'npm-package',
      name,
      description: pkg.description || firstParagraph(readme ?? '') || '설명이 없습니다.',
      dependencies: deps.list(),
      install,
      entryFiles: ['package.json'],
      tags: (pkg.keywords ?? []).slice(0, 10),
      readme: readme ?? undefined,
    }
    return { ...out, files: ctx.files, warnings: ctx.warnings }
  },
}

const pythonPackage: Detector = {
  id: 'python-package',
  async detect(ctx) {
    const hasPy = hasFile(ctx, 'pyproject.toml') || hasFile(ctx, 'setup.py') || hasFile(ctx, 'requirements.txt')
    if (!hasPy) return null
    const deps = new DepSet()
    deps.add('python', 'runtime', 'Python')
    let name = ctx.repo
    let description = ''
    if (hasFile(ctx, 'pyproject.toml')) {
      const info = parsePyproject((await ctx.read('pyproject.toml')) ?? '', deps, 'pyproject.toml')
      name = info.name || name
      description = info.description || ''
    }
    if (hasFile(ctx, 'requirements.txt')) parseRequirements((await ctx.read('requirements.txt')) ?? '', deps, 'requirements.txt')
    const readme = await readReadme(ctx)
    if (readme) scanText(readme, deps, 'README')
    const out: Partial_ = {
      kind: 'python-package',
      name,
      description: description || firstParagraph(readme ?? '') || '설명이 없습니다.',
      dependencies: deps.list(),
      install: [
        { title: 'pip로 설치', command: `pip install ${name}`, note: 'PyPI에 배포된 경우' },
        { title: '소스에서 설치', command: `git clone https://github.com/${ctx.owner}/${ctx.repo}.git && cd ${ctx.repo} && pip install -e .` },
      ],
      entryFiles: ['pyproject.toml', 'requirements.txt', 'setup.py'].filter((f) => hasFile(ctx, f)),
      tags: ['python'],
      readme: readme ?? undefined,
    }
    return { ...out, files: ctx.files, warnings: ctx.warnings }
  },
}

const genericRepo: Detector = {
  id: 'repo',
  async detect(ctx) {
    const deps = new DepSet()
    const readme = await readReadme(ctx)
    if (readme) scanText(readme, deps, 'README')
    const mdFiles = listMatching(ctx, /\.md$/i)
    const tags: string[] = []
    if (mdFiles.length > 5 && ctx.files.filter((f) => f.type === 'blob').length * 0.6 < mdFiles.length) tags.push('prompts/docs')
    const out: Partial_ = {
      kind: 'repo',
      name: ctx.base.split('/').pop() || ctx.repo,
      description: firstParagraph(readme ?? '') || '설명이 없습니다.',
      dependencies: deps.list(),
      install: [
        { title: '저장소 받기', command: `git clone https://github.com/${ctx.owner}/${ctx.repo}.git` },
        ...(ctx.base ? [{ title: '이 폴더만 받기', command: `npx degit ${sourceSpec(ctx)} ./${slug(ctx.base.split('/').pop()!)}` }] : []),
      ],
      entryFiles: mdFiles.slice(0, 10),
      tags,
      readme: readme ?? undefined,
    }
    return { ...out, files: ctx.files, warnings: ctx.warnings }
  },
}

export const DETECTORS: Detector[] = [claudeSkill, claudePlugin, skillCollection, mcpServer, npmPackage, pythonPackage, genericRepo]
