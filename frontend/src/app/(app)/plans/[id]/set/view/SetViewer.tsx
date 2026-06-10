'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, Maximize, Minimize } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface SetFile {
  url: string
  label: string
  file_type: string
  songTitle: string
  songKey: string | null
  fileId?: string
  songId?: string
  hasEdits?: boolean
}

interface ViewerPage {
  fileIndex: number
  pageIndex: number
  totalPages: number
  file: SetFile
  chordProHtml?: string
}

interface ChordProContent {
  fileIndex: number
  html: string
  rawSource: string
}

export function SetViewerPage() {
  const { id } = useParams()
  const router = useRouter()
  const [files, setFiles] = useState<SetFile[]>([])
  const [pages, setPages] = useState<ViewerPage[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [pageCounts, setPageCounts] = useState<Record<number, number>>({})
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)
  const [chordProContents, setChordProContents] = useState<ChordProContent[]>([])
  const [fontSize, setFontSize] = useState(15)

  const remeasure = useCallback(() => {
    const firstChordPro = files.findIndex(f => f.file_type === 'chordpro')
    if (firstChordPro === -1) return
    measuredChordProPages.current = {}
    setReady(false)
    setMeasuringIndex(firstChordPro)
  }, [files])
  const [measuringIndex, setMeasuringIndex] = useState<number | null>(null)
  const measuredChordProPages = useRef<Record<number, string[]>>({})

  const measureDivRef = useCallback((div: HTMLDivElement | null) => {
    if (!div || measuringIndex === null) return

    requestAnimationFrame(() => {
      const pageHeight = (containerSize?.height ?? window.innerHeight) - 80
      const paragraphs = Array.from(div.querySelectorAll('.paragraph'))
      const chordProPages: string[] = []
      let currentHtml = ''
      let currentHeight = 0

      paragraphs.forEach(para => {
        const h = (para as HTMLElement).offsetHeight + 24
        if (currentHeight + h > pageHeight && currentHtml) {
          chordProPages.push(currentHtml)
          currentHtml = (para as HTMLElement).outerHTML
          currentHeight = h
        } else {
          currentHtml += (para as HTMLElement).outerHTML
          currentHeight += h
        }
      })
      if (currentHtml) chordProPages.push(currentHtml)

      // Store this file's paginated pages
      measuredChordProPages.current = {
        ...measuredChordProPages.current,
        [measuringIndex]: chordProPages.length > 0 ? chordProPages : ['']
      }

      // Find the next ChordPro file that hasn't been measured yet
      const nextIndex = files.findIndex(
        (f, i) => f.file_type === 'chordpro' && i > measuringIndex && !measuredChordProPages.current[i]
      )

      if (nextIndex !== -1) {
        // More ChordPro files to measure — trigger next
        setMeasuringIndex(nextIndex)
        return
      }

      // All ChordPro files measured — build final pages array
      const newPages: ViewerPage[] = []
      files.forEach((f, fileIndex) => {
        if (f.file_type === 'chordpro') {
          const pages = measuredChordProPages.current[fileIndex] || ['']
          pages.forEach((html, p) => {
            newPages.push({ fileIndex, pageIndex: p, totalPages: pages.length, file: f, chordProHtml: html })
          })
        } else {
          const count = pageCounts[fileIndex] || 1
          for (let p = 0; p < count; p++) {
            newPages.push({ fileIndex, pageIndex: p, totalPages: count, file: f })
          }
        }
      })

      setMeasuringIndex(null)
      if (newPages.length > 0) { setPages(newPages); setReady(true) }
    })
  }, [measuringIndex, containerSize, files, pageCounts])

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
    if (!raw) { router.push(`/plans/${id}/set`); return }
    const parsed: SetFile[] = JSON.parse(raw)
    setFiles(parsed)

    const fetchChordPro = async () => {
      if (typeof window === 'undefined') return
      const { default: ChordSheetJS } = await import('chordsheetjs')
      const contents: ChordProContent[] = []

      for (let i = 0; i < parsed.length; i++) {
        const file = parsed[i]
        if (file.file_type !== 'chordpro') continue
        try {
          console.log('Fetching ChordPro file:', file.url)
          const response = await fetch(file.url)
          console.log('Fetch status:', response.status)
          const text = await response.text()
          console.log('ChordPro content length:', text.length, 'first 100 chars:', text.substring(0, 100))
          const parser = new ChordSheetJS.ChordProParser()
          const song = parser.parse(text)

          let rendered = song
          try {
            if (file.songKey) {
              const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
              const normalize = (k: string) => k.replace('Db','C#').replace('Eb','D#').replace('Gb','F#').replace('Ab','G#').replace('Bb','A#')
              const rawKey = song.metadata?.get('key')
              const originalKey = Array.isArray(rawKey) ? rawKey[0] : rawKey
              if (originalKey && typeof originalKey === 'string') {
                const fromIdx = CHROMATIC.indexOf(normalize(originalKey))
                const toIdx = CHROMATIC.indexOf(normalize(file.songKey))
                if (fromIdx !== -1 && toIdx !== -1) {
                  let semitones = toIdx - fromIdx
                  if (semitones < 0) semitones += 12
                  if (semitones !== 0) rendered = song.transpose(semitones)
                }
              }
            }
          } catch (transposeErr) {
            console.warn('Transposition failed, using original key', transposeErr)
            rendered = song
          }

          const formatter = new ChordSheetJS.HtmlDivFormatter()
          const rawHtml = formatter.format(rendered)

          // HtmlDivFormatter puts <h1 class="title"> and <h2 class="subtitle"> outside
          // the .paragraph divs, so the paginator skips them. Extract them and wrap
          // them in a .paragraph so they flow correctly into page 1.
          const titleMatch = rawHtml.match(/<h1 class="title">(.*?)<\/h1>/)
          const subtitleMatch = rawHtml.match(/<h2 class="subtitle">(.*?)<\/h2>/)
          let titleBlock = ''
          if (titleMatch || subtitleMatch) {
            titleBlock = `<div class="paragraph chordpro-title-block">`
            if (titleMatch) titleBlock += `<div class="chordpro-song-title">${titleMatch[1]}</div>`
            if (subtitleMatch) titleBlock += `<div class="chordpro-song-subtitle">${subtitleMatch[1]}</div>`
            titleBlock += `</div>`
          }

          // Strip the original h1/h2 from the html and prepend our wrapped version
          const html = titleBlock + rawHtml
            .replace(/<h1 class="title">[^<]*<\/h1>\s*/g, '')
            .replace(/<h2 class="subtitle">[^<]*<\/h2>\s*/g, '')

          contents.push({ fileIndex: i, html, rawSource: text })
        } catch (err) {
          console.error('Failed to load ChordPro file at index', i, ':', err)
          console.error('File details:', JSON.stringify(file))
        }
      }
      setChordProContents(contents)
    }

    fetchChordPro()
  }, [id, router])

  useEffect(() => {
    if (files.length === 0) return
    const hasChordPro = files.some(f => f.file_type === 'chordpro')
    if (!hasChordPro) {
      const newPages: ViewerPage[] = []
      files.forEach((file, fileIndex) => {
        const count = pageCounts[fileIndex] || 1
        for (let p = 0; p < count; p++) {
          newPages.push({ fileIndex, pageIndex: p, totalPages: count, file })
        }
      })
      if (newPages.length > 0) { setPages(newPages); setReady(true) }
      return
    }
    const hasChordProContent = chordProContents.length > 0
    if (!hasChordProContent) return
    const firstChordPro = files.findIndex(f => f.file_type === 'chordpro')
    if (firstChordPro !== -1) {
      measuredChordProPages.current = {}
      setMeasuringIndex(firstChordPro)
    }
  }, [files, chordProContents, pageCounts])

  const goTo = useCallback((n: number) => {
    setCurrentPage(Math.max(0, Math.min(n, pages.length - 1)))
  }, [pages.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'ArrowDown') goTo(currentPage + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') goTo(currentPage - 1)
      if (e.key === 'Escape') router.push(`/plans/${id}/set`)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentPage, goTo, id, router])

  const current = pages[currentPage]

  if (!ready || pages.length === 0) return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {measuringIndex !== null && chordProContents.find(c => c.fileIndex === measuringIndex) && (
        <div
          ref={measureDivRef}
          className="chordpro-render"
          style={{ position: 'absolute', left: -9999, top: 0, width: (containerSize?.width ?? window.innerWidth) - 64, fontFamily: 'monospace', fontSize, lineHeight: 1.6, pointerEvents: 'none' }}
          dangerouslySetInnerHTML={{ __html: chordProContents.find(c => c.fileIndex === measuringIndex)!.html }}
        />
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
        Loading set…
      </div>
    </div>
  )

  return (
    <div
      style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', cursor: controlsVisible ? 'default' : 'none' }}
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
        <button onClick={() => router.push(`/plans/${id}/set`)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', padding: 4 }}>
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
        {current.file.file_type === 'chordpro' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); setFontSize(s => { const n = Math.max(10, s - 1); setTimeout(remeasure, 0); return n }) }}
              style={{ background: 'none', border: '1px solid #444', borderRadius: 4, color: '#aaa', cursor: 'pointer', padding: '2px 8px', fontSize: 16, lineHeight: 1 }}
            >−</button>
            <span style={{ color: '#666', fontSize: 11, minWidth: 28, textAlign: 'center' }}>{fontSize}px</span>
            <button
              onClick={e => { e.stopPropagation(); setFontSize(s => { const n = Math.min(28, s + 1); setTimeout(remeasure, 0); return n }) }}
              style={{ background: 'none', border: '1px solid #444', borderRadius: 4, color: '#aaa', cursor: 'pointer', padding: '2px 8px', fontSize: 16, lineHeight: 1 }}
            >+</button>
          </div>
        )}
        {canFullscreen && (
          <button onClick={toggleFullscreen} style={{ background: 'none', border: '1px solid #444', borderRadius: 4, color: '#aaa', cursor: 'pointer', padding: '4px 8px', display: 'flex' }}>
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        )}
      </div>

      {/* Page display */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        {/* Prev */}
        <button
          onClick={e => { e.stopPropagation(); goTo(currentPage - 1) }}
          disabled={currentPage === 0}
          style={{ position: 'absolute', left: 8, zIndex: 10, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === 0 ? 'not-allowed' : 'pointer', color: '#fff', transition: 'opacity 0.3s', opacity: controlsVisible ? (currentPage === 0 ? 0.3 : 1) : 0, pointerEvents: controlsVisible ? 'auto' : 'none' }}
        >
          <ChevronLeft size={24} />
        </button>

        {/* Page content */}
        {current.file.file_type === 'chordpro' ? (
          <div
            className="chordpro-render"
            style={{ width: containerSize ? containerSize.width - 64 : '100%', height: containerSize ? containerSize.height - 32 : '100%', overflow: 'auto', padding: '16px 24px', background: '#fff', borderRadius: 4, fontSize }}
            dangerouslySetInnerHTML={{ __html: current.chordProHtml || '' }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Document
              file={current.file.url}
              onLoadSuccess={({ numPages }) => {
              setPageCounts(prev => {
                const updated = { ...prev, [current.fileIndex]: numPages }
                if (numPages > 1) {
                  setPages(prevPages => {
                    const otherPages = prevPages.filter(p => p.fileIndex !== current.fileIndex)
                    const newFilePages: ViewerPage[] = []
                    for (let p = 0; p < numPages; p++) {
                      newFilePages.push({ fileIndex: current.fileIndex, pageIndex: p, totalPages: numPages, file: current.file })
                    }
                    return [...otherPages, ...newFilePages].sort((a, b) => a.fileIndex - b.fileIndex || a.pageIndex - b.pageIndex)
                  })
                }
                return updated
              })
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
        )}

        {/* Next */}
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