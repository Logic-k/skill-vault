import JSZip from 'jszip'
import { fetchBinary } from './github'
import type { FileEntry } from './types'

const MAX_FILES = 300
const MAX_BYTES = 25 * 1024 * 1024

/** Download every blob under the analyzed folder into a zip and trigger a browser download. */
export async function downloadZip(
  owner: string,
  repo: string,
  ref: string,
  base: string,
  files: FileEntry[],
  zipName: string,
  onProgress?: (done: number, total: number) => void,
) {
  const blobs = files.filter((f) => f.type === 'blob')
  if (blobs.length > MAX_FILES) throw new Error(`파일이 ${blobs.length}개라 너무 많습니다 (최대 ${MAX_FILES}개). git clone 이나 degit 을 사용하세요.`)
  const total = blobs.reduce((n, f) => n + (f.size ?? 0), 0)
  if (total > MAX_BYTES) throw new Error('전체 크기가 25MB를 넘어 브라우저에서 받기엔 큽니다. git clone 을 사용하세요.')
  const zip = new JSZip()
  const root = zip.folder(zipName)!
  let done = 0
  const queue = [...blobs]
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const f = queue.shift()!
      const data = await fetchBinary(owner, repo, ref, base ? `${base}/${f.path}` : f.path)
      root.file(f.path, data)
      onProgress?.(++done, blobs.length)
    }
  })
  await Promise.all(workers)
  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${zipName}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
