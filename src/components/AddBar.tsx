import { useState } from 'react'
import { parseGitHubUrl } from '../lib/github'

export function AddBar({ busy, progress, onAnalyze }: { busy: boolean; progress: string; onAnalyze: (url: string) => void }) {
  const [value, setValue] = useState('')
  const parsed = parseGitHubUrl(value)
  const invalid = value.trim() !== '' && !parsed
  return (
    <form
      className="addbar"
      onSubmit={(e) => {
        e.preventDefault()
        if (parsed && !busy) onAnalyze(value)
      }}
    >
      <input
        className="addbar-input"
        placeholder="GitHub 링크를 붙여넣으세요. 예: https://github.com/anthropics/skills/tree/main/skills/pdf"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPaste={(e) => {
          const t = e.clipboardData.getData('text')
          if (parseGitHubUrl(t) && !busy) {
            e.preventDefault()
            setValue(t)
            onAnalyze(t)
          }
        }}
        aria-invalid={invalid}
        spellCheck={false}
      />
      <button type="submit" className="btn primary" disabled={!parsed || busy}>
        {busy ? '분석 중…' : '분석'}
      </button>
      <div className="addbar-hint">
        {busy ? progress : invalid ? 'GitHub 주소만 인식합니다. owner/repo 형식도 됩니다.' : parsed ? `${parsed.owner}/${parsed.repo}${parsed.path ? ' / ' + parsed.path : ''}` : '붙여넣는 즉시 분석이 시작됩니다.'}
      </div>
    </form>
  )
}
