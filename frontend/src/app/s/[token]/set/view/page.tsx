'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, Maximize, Minimize } from 'lucide-react'
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

export default function PublicSetViewerPage() {
  const { token } = useParams()
  const router = useRouter()
  const [files, setFiles] = useState<SetFile[]>([])
  const [pages, setPages] = useState<ViewerPage[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [pageCounts, setPageCounts] = useState<Record<number, number>>({})
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled && !window.matchMedia('(display-mode: standalone)').matches

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const containerNodeRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    containerNodeRef.current = node
    if (node) {
      const updateSize = () => setContainerSize({ width: node.clientWidth, height: node.clientHeight })
      updateSize()
      const ro = new ResizeObserver(updateSize)
      ro.observe(node)
    }
  }, [])

  const [ready, setReady] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  useEffect(() => {
    const node = containerNodeRef.current
    if (!node) return
    const timer = setTimeout(() => {
      setContainerSize({ width: node.clientWidth, height: node.clientHeight })
    }, 350)
    return () => clearTimeout(timer)
  }, [controlsVisible])
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef<number | null>(null)

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2500)
  }, [])

  useEffect(() => {
    showControls()
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [showControls])

  useEffect(() => {
    document.body.classList.add('set-viewer-active')
    return () => document.body.classList.remove('set-viewer-active')
  }, [])

  useEffect(() => {
    const raw = sessionStorage.getItem('setViewerFiles')
    if (!raw) { router.push(`/s/${token}/set`); return }
    const parsed: SetFile[] = JSON.parse(raw)
    setFiles(parsed)
  }, [token, router])

  useEffect(() => {
    if (files.length === 0) return
    // Build initial page list immediately with 1 page per file
    // Pages will expand as PDFs report their actual page counts
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
      if (e.key === 'Escape') router.push(`/s/${token}/set`)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentPage, goTo, token, router])

  if (!ready || pages.length === 0) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      Loading set…
    </div>
  )

  const current = pages[currentPage]

  return (
    <div
      style={{ minHeight: '100vh', background: '#1a1a1a', display: 'flex', flexDirection: 'column', cursor: controlsVisible ? 'default' : 'none' }}
      onClick={showControls}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return
        const diff = touchStartX.current - e.changedTouches[0].clientX
        if (Math.abs(diff) > 50) {
          if (diff > 0) goTo(currentPage + 1)
          else goTo(currentPage - 1)
        }
        touchStartX.current = null
      }}
    >
      {/* Toolbar */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, transition: 'opacity 0.3s, max-height 0.3s', opacity: controlsVisible ? 1 : 0, maxHeight: controlsVisible ? 60 : 0, overflow: 'hidden', pointerEvents: controlsVisible ? 'auto' : 'none' }}>
        <button onClick={() => router.push(`/s/${token}/set`)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', padding: 4 }}>
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
        <span style={{ color: '#666', fontSize: 12, flexShrink: 0 }}>{currentPage + 1} / {pages.length}</span>
        {canFullscreen && (
          <button onClick={toggleFullscreen} style={{ background: 'none', border: '1px solid #444', borderRadius: 4, color: '#aaa', cursor: 'pointer', padding: '4px 8px', display: 'flex' }}>
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        )}
      </div>

      {/* Page display */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        <button
          onClick={e => { e.stopPropagation(); goTo(currentPage - 1) }}
          disabled={currentPage === 0}
          style={{ position: 'absolute', left: 8, zIndex: 10, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === 0 ? 'not-allowed' : 'pointer', color: '#fff', transition: 'opacity 0.3s', opacity: controlsVisible ? (currentPage === 0 ? 0.3 : 1) : 0, pointerEvents: controlsVisible ? 'auto' : 'none' }}
        >
          <ChevronLeft size={24} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Document
            file={current.file.url}
            onLoadSuccess={({ numPages }) => {
              setPageCounts(prev => ({ ...prev, [current.fileIndex]: numPages }))
            }}
            loading={<div style={{ color: '#888', padding: 40 }}>Loading…</div>}
          >
            <Page
              pageNumber={current.pageIndex + 1}
              width={containerSize ? Math.min(containerSize.width - 16, (containerSize.height - 16) * 0.707) : undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        </div>

        <button
          onClick={e => { e.stopPropagation(); goTo(currentPage + 1) }}
          disabled={currentPage === pages.length - 1}
          style={{ position: 'absolute', right: 8, zIndex: 10, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === pages.length - 1 ? 'not-allowed' : 'pointer', color: '#fff', transition: 'opacity 0.3s', opacity: controlsVisible ? (currentPage === pages.length - 1 ? 0.3 : 1) : 0, pointerEvents: controlsVisible ? 'auto' : 'none' }}
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  )
}
