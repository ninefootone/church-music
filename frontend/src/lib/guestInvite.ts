// Guest musician invites (see claude/guest-mode.md): the message an admin copies and sends with the link.
import { format, parseISO } from 'date-fns'

export function guestInviteMessage(opts: { name: string; churchName?: string | null; planDate?: string | null; link: string }): string {
  const first = opts.name.trim().split(/\s+/)[0] || 'there'
  let when = ''
  try { if (opts.planDate) when = ` on ${format(parseISO(opts.planDate), 'EEEE d MMMM')}` } catch {}
  const where = opts.churchName ? ` at ${opts.churchName}` : ''
  return `Hi ${first}, thanks for playing${where}${when}! You can see the plan and the music on SongStack:\n\n` +
    `1. Open ${opts.link}\n2. Sign in or create a free account\n\n` +
    `The link is just for you and works once. You'll see the plans you're playing in — on the website or the SongStack iPad app.`
}

// Copy to the clipboard; false if the browser refused (then show the text for manual copying).
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}
