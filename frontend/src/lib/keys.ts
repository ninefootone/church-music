// Every key the app offers in a key dropdown (songs, files, plan overrides, transpose).
// Majors then minors. Keep this the ONLY list — it used to be copied into eight files and
// four of them never got the minor keys.
export const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm']

// Keys can arrive as 'B♭' / 'F♯' (library imports, master-library copies) or with stray
// spaces. Always compare via sameKey — a raw === puts 'B♭' files under "Other keys" on a
// 'Bb' song. Enharmonics (C# vs Db) deliberately stay different: the chart is spelt differently.
export function normaliseKey(k?: string | null): string {
  return (k || '').replace(/♯/g, '#').replace(/♭/g, 'b').replace(/\s+/g, '')
}

export function sameKey(a?: string | null, b?: string | null): boolean {
  return normaliseKey(a) === normaliseKey(b)
}
