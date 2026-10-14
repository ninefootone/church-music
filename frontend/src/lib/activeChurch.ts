// Which church a multi-church user is currently working in, remembered per browser.
//
// The backend scopes every request by the x-church-id header (see lib/api.ts), so "switching
// church" is purely a client-side choice of which membership to send. We remember the choice in
// localStorage so it survives reloads; if it's missing or no longer valid (removed from that
// church, different person signed in on this browser) ChurchContext falls back to the first church.
//
// Storage can be blocked (private mode, strict settings), so every access is wrapped — the app
// still works, it just won't remember the choice.

const KEY = 'songstack.activeChurchId'

export function getRememberedChurchId(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function rememberChurchId(churchId: string) {
  try {
    localStorage.setItem(KEY, churchId)
  } catch {
    // storage blocked — the choice just won't persist
  }
}
