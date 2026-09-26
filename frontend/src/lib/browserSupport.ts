// The set viewer's PDF engine (pdf.js 5) uses `class { static {} }` blocks, which Safari can't even parse
// before 16.4 (iPadOS 15 and earlier — e.g. iPad Air 2 / mini 4). Detect that up front so we can show a
// friendly message instead of a "client-side exception" crash.
export function canRunSetViewer(): boolean {
  if (typeof window === 'undefined') return true
  try {
    // eslint-disable-next-line no-new-func
    new Function('class A { static { } }')
    return true
  } catch (e) {
    // Only a SyntaxError means "too old". Anything else (e.g. a future Content-Security-Policy blocking
    // new Function) must NOT lock modern browsers out of the set viewer.
    return !(e instanceof SyntaxError)
  }
}