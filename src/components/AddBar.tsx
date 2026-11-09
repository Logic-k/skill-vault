import { useState } from 'react'
import { parseGitHubUrl } from '../lib/github'
import { domainOf, normalizeUrl } from '../lib/web'

export function AddBar({ busy, progress, onAnalyze }: { busy: boolean; progress: string; onAnalyze: (url: string) => void }) {
  const [value, setValue] = useState('')
  const gh = parseGitHubUrl(value)
  const web = !gh ? normalizeUrl(value) : null
  const ok = !!gh || !!web
  const invalid = value.trim() !== '' && !ok
  const hint = busy
    ? progress
    : invalid
      ? 'GitHub 주소 또는 웹 주소(https://…)를 넣어 주세요.'
      : gh
        ? `GitHub · ${gh.owner}/${gh.repo}${gh.path ? ' / ' + gh.path : ''}`
        : web
          ? `웹사이트 · ${domainOf(web)}`
          : 'GitHub 저장소든 AI 웹사이트든, 붙여넣는 즉시 분석이 시작됩니다.'
  return (
    <form
      className="addbar"
      onSubmit={(e) => {
        e.preventDefault()
        if (ok && !busy) onAnalyze(value)
      }}
    >
      <input
        className="addbar-input"
        placeholder="GitHub 링크나 AI 사이트 주소를 붙여넣으세요. 예: github.com/anthropics/skills/tree/main/skills/pdf 또는 perplexity.ai"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPaste={(e) => {
          const t = e.clipboardData.getData('text')
          if ((parseGitHubUrl(t) || normalizeUrl(t)) && !busy) {
            e.preventDefault()
            setValue(t)
            onAnalyze(t)
          }
        }}
        aria-invalid={invalid}
        spellCheck={false}
      />
      <button type="submit" className="btn primary" disabled={!ok || busy}>
        {busy ? '분석 중…' : '분석'}
      </button>
      <div className="addbar-hint">{hint}</div>
    </form>
  )
}
