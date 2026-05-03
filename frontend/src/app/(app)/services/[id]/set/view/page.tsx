'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface SetFile {
  url: string
  label: string
  file_type: string
  songTitle: string
  songKey: string | null
}

interface ViewerPage {
  fileIndex: number
  pageIndex: number
  totalPages: number
  file: SetFile
}

export default function SetViewerPage() {
  const { id } = useParams()
  const router = useRouter()
  const [files, setFiles] = useState<SetFile[]>([])
  const [pages, setPages] = useState<ViewerPage[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [pageCounts, setPageCounts] = useState<Record<number, number>>({})
  const [scale, setScale] = useState(1)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('setViewerFiles')
    if (!raw) { router.push(`/services/${id}/set`); return }
    const parsed: SetFile[] = JSON.parse(raw)
    setFiles(parsed)
  }, [id, router])

  // Build page list once we know page counts for all PDF files
  useEffect(() => {
    if (files.length === 0) return
    const pdfFiles = files.filter(f => f.file_type !== 'chordpro')
    const allCountsKnown = pdfFiles.every((_, i) => {
      const fileIdx = files.indexOf(pdfFiles[i])
      return pageCounts[fileIdx] !== undefined
    })
    if (!allCountsKnown && pdfFiles.length > 0) return

    const newPages: ViewerPage[] = []
    files.forEach((file, fileIndex) => {
      const count = pageCounts[fileIndex] || 1
      for (let p = 0; p < count; p++) {
        newPages.push({ fileIndex, pageIndex: p, totalPages: count, file })
      }
    })
    setPages(newPages)
    setReady(true)
  }, [files, pageCounts])

  const goTo = useCallback((n: number) => {
    setCurrentPage(Math.max(0, Math.min(n, pages.length - 1)))
  }, [pages.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'ArrowDown') goTo(currentPage + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') goTo(currentPage - 1)
      if (e.key === 'Escape') router.push(`/services/${id}/set`)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentPage, goTo, id, router])

  if (!ready || pages.length === 0) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      Loading set…
    </div>
  )

  const current = pages[currentPage]

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => router.push(`/services/${id}/set`)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <X size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#fff', fontWeight: 600, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current.file.songTitle}
          </p>
          <p style={{ color: '#888', fontSize: 12, margin: 0 }}>
            {current.file.label}{current.file.songKey ? ` · ${current.file.songKey}` : ''}{current.totalPages > 1 ? ` · p${current.pageIndex + 1}/${current.totalPages}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} style={{ background: 'none', border: '1px solid #444', borderRadius: 4, color: '#aaa', cursor: 'pointer', padding: '4px 8px', display: 'flex' }}><ZoomOut size={14} /></button>
          <span style={{ color: '#888', fontSize: 12, minWidth: 40, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.1))} style={{ background: 'none', border: '1px solid #444', borderRadius: 4, color: '#aaa', cursor: 'pointer', padding: '4px 8px', display: 'flex' }}><ZoomIn size={14} /></button>
        </div>
        <span style={{ color: '#666', fontSize: 12, flexShrink: 0 }}>{currentPage + 1} / {pages.length}</span>
      </div>

      {/* Page display */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        {/* Prev */}
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 0}
          style={{ position: 'absolute', left: 8, zIndex: 10, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === 0 ? 'not-allowed' : 'pointer', opacity: currentPage === 0 ? 0.3 : 1, color: '#fff' }}
        >
          <ChevronLeft size={24} />
        </button>

        {/* PDF page */}
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Document
            file={current.file.url}
            onLoadSuccess={({ numPages }) => {
              setPageCounts(prev => ({ ...prev, [current.fileIndex]: numPages }))
            }}
            loading={<div style={{ color: '#888', padding: 40 }}>Loading…</div>}
          >
            <Page
              pageNumber={current.pageIndex + 1}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        </div>

        {/* Next */}
        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === pages.length - 1}
          style={{ position: 'absolute', right: 8, zIndex: 10, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === pages.length - 1 ? 'not-allowed' : 'pointer', opacity: currentPage === pages.length - 1 ? 0.3 : 1, color: '#fff' }}
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  )
}
