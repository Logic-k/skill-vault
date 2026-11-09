import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'

export function Markdown({ text, baseUrl }: { text: string; baseUrl?: string }) {
  const html = useMemo(() => {
    let raw = marked.parse(text, { async: false, gfm: true }) as string
    if (baseUrl) {
      raw = raw.replace(/(src|href)="(?!https?:|#|mailto:|data:)([^"]+)"/g, (_m, attr, p) => `${attr}="${baseUrl}/${p.replace(/^\.?\//, '')}"`)
    }
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] })
  }, [text, baseUrl])
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
}
