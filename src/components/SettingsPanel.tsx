import { useRef, useState } from 'react'
import { buildSeed, SEED_DATE } from '../data/seed'
import { store } from '../lib/store'
import type { Settings } from '../lib/types'

export function SettingsPanel({ settings, count, onClose }: { settings: Settings; count: number; onClose: () => void }) {
  const [label, setLabel] = useState('')
  const [keywords, setKeywords] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const addCategory = () => {
    const kws = keywords.split(/[,\n]/).map((k) => k.trim()).filter(Boolean)
    if (!label.trim() || !kws.length) return
    const id = label.trim().toLowerCase().replace(/\s+/g, '-')
    store.setSettings({ customCategories: [...settings.customCategories.filter((c) => c.id !== id), { id, label: label.trim(), keywords: kws }] })
    setLabel('')
    setKeywords('')
  }

  const download = () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `skill-vault-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="detail" onClick={(e) => e.stopPropagation()}>
        <header className="detail-head">
          <h2>설정</h2>
          <button className="btn icon" onClick={onClose} aria-label="닫기">✕</button>
        </header>
        <div className="detail-body">
          <section>
            <h4>GitHub 개인 토큰 <small>(선택)</small></h4>
            <p className="muted small">
              토큰 없이도 동작하지만 시간당 60회 요청 한도가 있습니다. 토큰을 넣으면 5000회로 늘고 비공개 저장소도 읽습니다.
              토큰은 이 브라우저에만 저장되고 내보내기 파일에는 포함되지 않습니다. 권한은 <code>public_repo</code>(또는 읽기 전용 fine-grained)면 충분합니다.
            </p>
            <input
              type="password"
              className="input"
              placeholder="ghp_… 또는 github_pat_…"
              value={settings.token}
              onChange={(e) => store.setSettings({ token: e.target.value })}
              autoComplete="off"
            />
          </section>

          <section>
            <h4>내 카테고리 추가</h4>
            <p className="muted small">이름과 키워드를 넣으면 다음 분석부터 자동 분류에 쓰입니다. 기본 카테고리와 같은 이름을 쓰면 키워드가 합쳐집니다.</p>
            <div className="row">
              <input className="input" placeholder="카테고리 이름 (예: 교육청 업무)" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <textarea className="input" rows={2} placeholder="키워드, 쉼표로 구분 (예: 나이스, 공문, 교육청, hwp)" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            <button className="btn" onClick={addCategory} disabled={!label.trim() || !keywords.trim()}>추가</button>
            {settings.customCategories.length > 0 && (
              <ul className="sublist">
                {settings.customCategories.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.label}</strong>
                      <div className="muted small">{c.keywords.join(', ')}</div>
                    </div>
                    <button className="btn tiny danger" onClick={() => store.setSettings({ customCategories: settings.customCategories.filter((x) => x.id !== c.id) })}>삭제</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4>백업과 이동</h4>
            <p className="muted small">데이터는 이 브라우저에만 저장됩니다({count}건). 다른 기기로 옮기거나 백업하려면 JSON으로 내보내세요.</p>
            <div className="row wrap">
              <button className="btn" onClick={download}>JSON 내보내기</button>
              <button className="btn" onClick={() => fileRef.current?.click()}>JSON 가져오기 (합치기)</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    const n = store.importJson(await f.text(), 'merge')
                    setMsg(`${n}건을 가져왔습니다.`)
                  } catch {
                    setMsg('파일을 읽지 못했습니다. 이 앱에서 내보낸 JSON인지 확인하세요.')
                  }
                  e.target.value = ''
                }}
              />
            </div>
          </section>

          <section>
            <h4>예시 서재</h4>
            <p className="muted small">{SEED_DATE} 기준 오픈소스 서재 33건과 AI 웹사이트 18곳입니다. 이미 있는 항목은 건너뜁니다.</p>
            <div className="row wrap">
              <button
                className="btn"
                onClick={() => {
                  const n = store.addMany(buildSeed(settings.customCategories), true)
                  setMsg(`예시 ${n}건을 추가했습니다.`)
                }}
              >
                예시 서재 불러오기 (GitHub 33 + AI 사이트 18)
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  if (confirm(`보관함의 ${count}건을 모두 지울까요? 되돌릴 수 없습니다.`)) {
                    store.importJson(JSON.stringify({ skills: [] }), 'replace')
                    setMsg('모두 지웠습니다.')
                  }
                }}
              >
                전체 비우기
              </button>
            </div>
          </section>
          {msg && <p className="muted">{msg}</p>}
        </div>
      </aside>
    </div>
  )
}
