'use client'

import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'
import FeedbackForm from '@/components/ui/FeedbackForm'

interface Member {
  id: string
  user_id: string
  name: string
  email: string
  image_url?: string
  role: string
}

interface HelpTopic {
  id: string
  title: string
  content: () => React.ReactNode
}

interface HelpSection {
  section: string
  topics: HelpTopic[]
}

function GetHelpContent({ admins, loading, showForm, onShowForm, onFormSuccess }: {
  admins: Member[]
  loading: boolean
  showForm: boolean | 'sent'
  onShowForm: () => void
  onFormSuccess: () => void
}) {
  return (
    <div>
      <div className="help-content-block">
        <h3 className="help-content-subheading">Your church admins</h3>
        <p className="help-content-body">
          For questions about your song library, plans, or access — get in touch with one of your church admins directly.
        </p>
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : admins.length === 0 ? (
          <p className="text-muted">No admins found.</p>
        ) : (
          <div className="help-admin-list">
            {admins.map(admin => (
              <div key={admin.id} className="help-admin-row">
                <div className="member-avatar-wrap">
                  {admin.image_url ? (
                    <img src={admin.image_url} alt={admin.name || admin.email} className="member-avatar-img" />
                  ) : (
                    <div className="member-avatar-placeholder">
                      {(admin.name || admin.email || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="help-admin-info">
                  <p className="help-admin-name">{admin.name || admin.email}</p>
                  {admin.name && admin.email && (
                    <a href={`mailto:${admin.email}`} className="help-admin-email">
                      <Mail size={13} />{admin.email}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="help-content-block">
        <h3 className="help-content-subheading">Song Stack support</h3>
        <p className="help-content-body">
          Found a bug, got a feature request, or just want to say hello? Get in touch with the Song Stack team below.
        </p>
        {showForm === 'sent' ? (
          <p className="help-content-body" style={{ color: 'var(--color-brand-500)', fontWeight: 600 }}>Thanks! We&apos;ll get back to you as soon as we can.</p>
        ) : showForm ? (
          <FeedbackForm onSuccess={onFormSuccess} />
        ) : (
          <button className="btn btn-ghost" onClick={onShowForm}>
            Contact Song Stack →
          </button>
        )}
      </div>
    </div>
  )
}

export default function HelpPage() {
  const { church } = useChurch()
  const [admins, setAdmins] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState('what-is-song-stack')
  const [showContactForm, setShowContactForm] = useState<boolean | 'sent'>(false)
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['Getting started'])
  )

  const toggleSection = (section: string, topics: HelpTopic[]) => {
    if (topics.length === 1) {
      selectTopic(section, topics[0].id)
      return
    }
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) { next.delete(section) } else { next.add(section) }
      return next
    })
  }

  const selectTopic = (sectionName: string, topicId: string) => {
    setActiveId(topicId)
    setOpenSections(prev => new Set(prev).add(sectionName))
  }

  useEffect(() => {
    if (!church) return
    api.get('/api/members')
      .then(r => setAdmins(r.data.filter((m: Member) => m.role === 'admin')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [church])

  const helpSections: HelpSection[] = [
    {
      section: 'Getting started',
      topics: [
        {
          id: 'what-is-song-stack',
          title: 'What is Song Stack?',
          content: () => (
            <div>
              <p className="help-content-body">
                Song Stack is a tool for churches to manage their song library and plan worship services. It gives your whole team — musicians, band leaders, and admins — a shared space to organise music, build service plans, and share resources.
              </p>
              <p className="help-content-body">
                There are two main areas:
              </p>
              <p className="help-content-body">
                <strong>Songs:</strong> your church&apos;s full song library. Each song can hold lyrics, chord charts, PDFs, key information, tags, CCLI details, and more.
              </p>
              <p className="help-content-body">
                <strong>Plans:</strong> individual service plans, each with a running order of songs, assigned musicians, a shared set viewer, and options to download or email the plan.
              </p>
              <p className="help-content-body">
                Your role determines what you can do. Admins have full access. Members can view the library and plans they&apos;re part of. Admins can grant additional permissions to individual members from the Team page.
              </p>
            </div>
          ),
        },
        {
          id: 'signing-in',
          title: 'Signing in and your account',
          content: () => (
            <div>
              <p className="help-content-body">
                You can sign in with an email and password, or with your Google or Apple account. The same account works on the website and in the Song Stack iPad app.
              </p>
              <p className="help-content-body">
                Your account is tied to a church. If you&apos;ve been invited to join a church on Song Stack, follow the invite link in the message you received — this connects your account to that church automatically.
              </p>
              <p className="help-content-body">
                If you need to join a church and don&apos;t have an invite link, ask one of your church admins. They can find the invite link on the Team page.
              </p>
              <p className="help-content-body">
                <strong>Using Apple&apos;s Hide My Email?</strong> Apple then gives Song Stack a private relay address instead of your real one, which creates a separate account that isn&apos;t connected to your church yet. Enter your church&apos;s invite code to join it (on the website, or on the <strong>Join your church</strong> screen in the iPad app), or sign in with the email address you were invited with.
              </p>
            </div>
          ),
        },
        {
          id: 'your-account',
          title: 'Your account',
          content: () => (
            <div>
              <p className="help-content-body">
                Open the avatar menu in the top navigation and choose <strong>Account</strong>. There you can change your name and photo, update your email address and password, and connect or disconnect Google or Apple sign-in.
              </p>
              <p className="help-content-body">
                Your name is what other people see on the Team page and on plans where you&apos;re listed as a musician. If you change it on the Account page, it updates across Song Stack automatically.
              </p>
              <p className="help-content-body">
                Our <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand-500)', fontWeight: 600 }}>privacy policy</a> explains what we store about you and how long we keep it.
              </p>
            </div>
          ),
        },
        {
          id: 'deleting-your-account',
          title: 'Deleting your account',
          content: () => (
            <div>
              <p className="help-content-body">
                You can delete your own account at any time, on the website or in the iPad app. It is immediate and can&apos;t be undone.
              </p>
              <p className="help-content-body">
                <strong>On the website:</strong> open the avatar menu, choose <strong>Account</strong>, scroll below your profile to <strong>Delete account</strong>, and click <strong>Delete my account</strong>. You&apos;ll be asked to type DELETE to confirm.
              </p>
              <p className="help-content-body">
                <strong>In the iPad app:</strong> go to <strong>Settings</strong> and use the red <strong>Delete account</strong> card at the very bottom. If you haven&apos;t joined a church yet, there&apos;s a <strong>Delete my account</strong> link on the Join your church screen.
              </p>
              <p className="help-content-body">
                <strong>What happens:</strong> your account and personal details are removed. Your name on past plans becomes &ldquo;Former member&rdquo;. Shared PDF markings you drew stay for the church but are no longer attributed to you. In the iPad app, your personal markings, downloads and custom sets are cleared from that iPad. Copies can remain in our nightly backups for up to 14 days.
              </p>
              <p className="help-content-body">
                <strong>When it&apos;s blocked:</strong> you&apos;ll see a message explaining why, and nothing is changed. This happens if you&apos;re the only admin of a church that still has other members (make someone else an admin from the Team page first), or if your church has an active subscription (cancel it under <strong>Settings → Billing</strong> first).
              </p>
              <p className="help-content-body">
                <strong>If you&apos;re the last member</strong> of your church, deleting your account also deletes the church, its songs, plans and files. The confirmation names the church so you can see this before you go ahead.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      section: 'Songs',
      topics: [
        {
          id: 'browsing-songs',
          title: 'Browsing the song library',
          content: () => (
            <div>
              <p className="help-content-body">
                The Songs page lists every song in your church&apos;s library. You can search by title, author, or lyric, and filter by tag or category using the controls at the top of the page.
              </p>
              <p className="help-content-body">
                Songs can be sorted by title, most sung, least sung, recently sung, or sung long ago — useful for spotting songs that haven't been used in a while.
              </p>
              <p className="help-content-body">
                Retired songs are hidden by default. Use the <strong>Show retired</strong> toggle to include them in the list.
              </p>
            </div>
          ),
        },
        {
          id: 'finding-songs-in-discover',
          title: 'Finding songs in Discover',
          content: () => (
            <div>
              <p className="help-content-body">
                <strong>Discover</strong> is a shared library of songs — public-domain hymns and songs Song Stack has permission to share — kept separate from your church&apos;s own library. It&apos;s where you find new material and add it to your library in one tap.
              </p>
              <p className="help-content-body">
                The page has two parts: a short list of <strong>curated highlights</strong> at the top, and a searchable <strong>Song library</strong> below. In the Song library you can search by title or author, filter by category, and filter by <strong>tag</strong> to browse by theme.
              </p>
              <p className="help-content-body">
                Open the <strong>Tags</strong> filter and pick one or more tags — the list narrows to songs carrying every tag you choose, so combine tags to focus in, and use <strong>Clear tags</strong> to start over. Only tags that appear on songs in the shared library are shown, so every tag returns results.
              </p>
              <p className="help-content-body">
                To add a song, use <strong>Add to library</strong> — this copies it into your church&apos;s library. Some songs include lyrics and files ready to use; others you&apos;ll complete yourself or access through SongSelect. Adding songs needs the <strong>Manage songs</strong> permission; members without it see a note to ask an admin.
              </p>
            </div>
          ),
        },
        {
          id: 'categories-and-tags',
          title: 'Categories and tags',
          content: () => (
            <div>
              <p className="help-content-body">
                <strong>Categories</strong> and <strong>tags</strong> organise your library in two different ways. Each song has exactly <strong>one category</strong> (chosen from a dropdown) and can carry <strong>any number of tags</strong>. Categories are broad buckets like Praise, Assurance or Response; tags describe themes like Grace, Advent or Communion, so songs are findable by subject.
              </p>
              <p className="help-content-body">
                Both come in two kinds: a set of <strong>suggested</strong> options shared across Song Stack, plus your church&apos;s <strong>own</strong> options. Your church&apos;s categories and tags are private to your church — they never appear in Discover or in other churches&apos; libraries.
              </p>
              <p className="help-content-body">
                On the Songs page, use the category chips and the <strong>Tags</strong> filter to narrow the list. You can pick one category and combine it with several tags at once.
              </p>
              <p className="help-content-body">
                Admins can add and remove the church&apos;s own categories and tags in <strong>Settings</strong>, where each shows how many songs use it. Deleting a tag removes it from those songs; deleting a category leaves those songs uncategorised. The suggested (shared) categories and tags can&apos;t be edited or deleted.
              </p>
            </div>
          ),
        },
        {
          id: 'adding-a-song',
          title: 'Adding a new song',
          content: () => (
            <div>
              <p className="help-content-body">
                From the Songs page, click <strong>Add song</strong>. Title and category are required — everything else is optional but recommended.
              </p>
              <p className="help-content-body">
                Key fields to fill in:
              </p>
              <p className="help-content-body">
                <strong>Title:</strong> how the song appears across Song Stack and in exported plans.
              </p>
              <p className="help-content-body">
                <strong>Default key:</strong> the key your church typically plays the song in. This can be overridden per plan.
              </p>
              <p className="help-content-body">
                <strong>Category:</strong> pick one from the dropdown — a broad bucket like Praise or Response (required). <strong>Tags:</strong> add as many as you like to describe the song&apos;s themes. Both drive filtering across the library and plan builder. See <em>Categories and tags</em> for how your church adds its own.
              </p>
              <p className="help-content-body">
                <strong>CCLI number:</strong> enter the song&apos;s CCLI number for licence reporting.
              </p>
              <p className="help-content-body">
                <strong>Lyrics:</strong> paste lyrics directly. These appear on the song page and, while planning, via the <strong>Show lyrics</strong> button on a plan&apos;s running order. They are not shown on the public share link.
              </p>
              <p className="help-content-body">
                <strong>Arrangement:</strong> set a default arrangement (e.g. Intro, Verse, Chorus, Bridge) using the arrangement builder. This can be customised per plan.
              </p>
              <p className="help-content-body">
                Once saved, you can upload files (chord charts, PDFs) from the song detail page.
              </p>
            </div>
          ),
        },
        {
          id: 'editing-a-song',
          title: 'Editing a song',
          content: () => (
            <div>
              <p className="help-content-body">
                Open the song from your library and click <strong>Edit</strong>. You can update any field — title, author, key, lyrics, tags, CCLI details, arrangement, and more.
              </p>
              <p className="help-content-body">
                Changes are saved when you click <strong>Save changes</strong>. Edits to a song&apos;s default arrangement don&apos;t affect arrangements that have already been customised on individual plans.
              </p>
            </div>
          ),
        },
        {
          id: 'uploading-files',
          title: 'Uploading files (PDF & ChordPro)',
          content: () => (
            <div>
              <p className="help-content-body">
                Song Stack supports two file types for each song:
              </p>
              <p className="help-content-body">
                <strong>PDF:</strong> chord charts, sheet music, or any printable document. PDFs can be merged and downloaded as a single file from a plan&apos;s set picker.
              </p>
              <p className="help-content-body">
                <strong>ChordPro (.cho / .chordpro):</strong> a plain-text format for chord charts that renders in the browser. ChordPro files support key transposition in the set viewer.
              </p>
              <p className="help-content-body">
                To upload, open the song and click <strong>Add file</strong>. You can upload multiple files at once and give each one a label (e.g. &quot;Guitar chart&quot;, &quot;Full score&quot;). Labels can be edited after upload.
              </p>
              <p className="help-content-body">
                A note on copyright: uploading files doesn&apos;t grant you the right to reproduce them. Make sure your church holds a valid CCLI licence that covers the songs you&apos;re uploading charts for.
              </p>
            </div>
          ),
        },
        {
          id: 'retiring-a-song',
          title: 'Retiring a song',
          content: () => (
            <div>
              <p className="help-content-body">
                Retiring a song hides it from the main library and plan builder without deleting it. This is useful for songs you no longer use but want to keep for reference.
              </p>
              <p className="help-content-body">
                To retire a song, open it and click <strong>Retire song</strong>. The song will disappear from the default library view but remains in the database. You can restore it at any time using the same button.
              </p>
              <p className="help-content-body">
                To see retired songs, use the <strong>Show retired</strong> toggle on the Songs page.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      section: 'Plans',
      topics: [
        {
          id: 'creating-a-plan',
          title: 'Creating a plan',
          content: () => (
            <div>
              <p className="help-content-body">
                From the Plans page, click <strong>New plan</strong>. Give the plan a date — this is the only required field. You can also add a title (e.g. &quot;Sunday Morning&quot;) and a time. The time is helpful for ordering plans when you have more than one on a single day.
              </p>
              <p className="help-content-body">
                If your church has <strong>plan templates</strong>, a <strong>Start from</strong> row appears at the top of the form. Choose <strong>Blank plan</strong> or one of your templates — a template fills in the time and title and brings in its running order. See <strong>Plan templates and song slots</strong> below.
              </p>
              <p className="help-content-body">
                Once created, you&apos;ll land on the plan detail page where you can add songs, assign musicians, and manage the running order. (When you start from a template with song slots, you go straight into editing the plan so you can add the songs.)
              </p>
              <p className="help-content-body">
                Plans are listed on the Plans page split into upcoming and past. The dashboard also shows your next few upcoming plans at a glance.
              </p>
            </div>
          ),
        },
        {
          id: 'adding-songs-to-plan',
          title: 'Adding songs to a plan',
          content: () => (
            <div>
              <p className="help-content-body">
                From the plan detail page, click <strong>Edit</strong> and then add songs and other items (welcome, prayer, sermon etc.). Search songs by title then click + to add it to the plan.
              </p>
              <p className="help-content-body">
                Alongside songs you can add <strong>service items</strong> — non-song elements such as a welcome, prayer, reading or offering. Under <strong>Other items</strong> you&apos;ll find quick buttons drawn from your church&apos;s <strong>Service items</strong> library (set up in Settings), plus <strong>+ Other</strong> for a one-off. Each can carry a <strong>title</strong>, a block of <strong>content</strong> — full text such as a prayer or creed, with bold and italic — and a short <strong>note</strong>. Expand the item to add or edit these.
              </p>
              <p className="help-content-body">
                On the plan, the public share link and the emailed plan, a service item that has content shows as a single line you click to reveal the full text (the email prints it in full) — so the running order stays tidy but the words are there when you need them.
              </p>
              <p className="help-content-body">
                Songs appear in the running order in the sequence you add them. You can drag and drop to reorder them using the dots on the left.
              </p>
              <p className="help-content-body">
                If the plan has empty <strong>song slots</strong> (usually from a template), each song you add fills the next empty slot instead of going to the end. Once the slots are full, songs are added to the end as normal. Adding a song from a song page with <strong>Add to plan</strong> fills the next slot too.
              </p>
              <p className="help-content-body">
                To remove a song from a plan, open the plan and use the x button next to the song. This only removes it from the plan — the song stays in your library.
              </p>
              <p className="help-content-body">
                Click a song in the running order to expand it. This reveals its sheet music, arrangement and CCLI details. If the song has lyrics saved in the library, a <strong>Show lyrics</strong> button appears here too — handy for checking the words while planning, without opening the song separately.
              </p>
            </div>
          ),
        },
        {
          id: 'custom-arrangements',
          title: 'Custom arrangements per plan',
          content: () => (
            <div>
              <p className="help-content-body">
                Each song has a default arrangement (if set on the song itself). When you add a song to a plan, it uses that default.
              </p>
              <p className="help-content-body">
                You can override this for a specific plan without affecting the song&apos;s default. Click the arrangement on the plan to open the arrangement builder and customise the order and sections for that plan only.
              </p>
              <p className="help-content-body">
                Custom arrangements are shown in the set viewer and included when you email or share the plan.
              </p>
            </div>
          ),
        },
        {
          id: 'adding-musicians',
          title: 'Adding musicians',
          content: () => (
            <div>
              <p className="help-content-body">
                From the plan detail page, click <strong>Add musician</strong>. You can search for existing church members by name, or add a guest by typing their name directly.
              </p>
              <p className="help-content-body">
                Each musician can be given a role for that plan (e.g. &quot;Guitar&quot;, &quot;Vocals&quot;). Roles are drawn from the list you&apos;ve set up in Settings, but you can type any role when adding.
              </p>
              <p className="help-content-body">
                Musicians assigned to a plan will see it highlighted on their dashboard under <strong>Your next plan</strong>.
              </p>
            </div>
          ),
        },
        {
          id: 'set-viewer',
          title: 'The set viewer',
          content: () => (
            <div>
              <p className="help-content-body">
                The set viewer is a full-screen view of all the files attached to songs in a plan. Open it from the plan page using the <strong>Set mode</strong> button.
              </p>
              <p className="help-content-body">
                You can navigate between files using the left and right keyboard arrow keys on desktop, a swipe on a touch device a Bluetooth footswitch. Controls auto-hide after a few seconds to maximise screen space.
              </p>
              <p className="help-content-body">
                For ChordPro files, you can transpose the key directly in the viewer using the key selector in the toolbar. This only affects your current session — it doesn&apos;t change the file itself.
              </p>
              <p className="help-content-body">
                The set viewer needs a reasonably recent browser — on an iPad that means iPadOS 16.4 or later. On an older iPad you&apos;ll see a short message instead; you can still open each song&apos;s music from the plan page.
              </p>
              <p className="help-content-body">
                The set viewer shows licensed content (sheet music, chord charts and lyrics), so it requires signing in. On a plan&apos;s public share link, Set mode is available to members of your church who are signed in — visitors without an account see the plan outline but not the music.
              </p>
            </div>
          ),
        },
        {
          id: 'sharing-a-plan',
          title: 'Sharing a plan',
          content: () => (
            <div>
              <p className="help-content-body">
                Every plan has a public share link that gives read-only access — useful for sharing with musicians who aren&apos;t on Song Stack. Anyone with the link can see the plan outline: the running order, song titles, authors, keys and capo, CCLI numbers, arrangements, and your team&apos;s notes. No account is needed for that.
              </p>
              <p className="help-content-body">
                Sheet music, chord charts, full lyrics and Set mode are only shown to members of your church who are signed in. A visitor opening the same link sees the outline and a prompt to sign in. This keeps licensed material behind a team login — your CCL licence lets you reproduce it for your own team, not publish it openly on the web.
              </p>
              <p className="help-content-body">
                Find the share link on the plan detail page. The link is unique to each plan and doesn&apos;t expire.
              </p>
            </div>
          ),
        },
        {
          id: 'downloading-pdf',
          title: 'Downloading a merged PDF',
          content: () => (
            <div>
              <p className="help-content-body">
                From a plan&apos;s set mode, click <strong>Download PDF</strong>. This merges all the PDF files attached to songs in the plan into a single downloadable PDF — useful for printing a full set&apos;s worth of music.
              </p>
              <p className="help-content-body">
                Only PDF files are included in the merge — ChordPro files are not. If a song has multiple PDFs, all of them are included.
              </p>
              <p className="help-content-body">
                The download is generated on the fly, so it always reflects the current state of the plan.
              </p>
            </div>
          ),
        },
        {
          id: 'emailing-a-plan',
          title: 'Emailing a plan',
          content: () => (
            <div>
              <p className="help-content-body">
                From the plan detail page, click <strong>Email plan</strong>. This sends a formatted email with the full running order — song titles, keys, arrangements, and musicians — along with links to any attached files.
              </p>
              <p className="help-content-body">
                You can send to all church members, or enter a custom list of email addresses. This is useful for distributing the plan to musicians before a service.
              </p>
            </div>
          ),
        },
        {
          id: 'duplicating-a-plan',
          title: 'Duplicating a plan',
          content: () => (
            <div>
              <p className="help-content-body">
                To reuse a plan as a starting point, duplicate it — the copy includes its running order, service items and assigned musicians. Use <strong>Duplicate</strong> on the plan, then set the new date and time.
              </p>
              <p className="help-content-body">
                The duplicate dialog also has a <strong>Title</strong> field, pre-filled with the original plan&apos;s title, so you can rename the copy as you create it.
              </p>
            </div>
          ),
        },
        {
          id: 'plan-templates',
          title: 'Plan templates and song slots',
          content: () => (
            <div>
              <p className="help-content-body">
                If your services follow the same pattern each week — say a 9.15am, an 11am and a 7pm — save each one as a <strong>plan template</strong>. A template holds the time, title, pre-service notes and running order, so a new plan only needs a date and the week&apos;s songs.
              </p>
              <p className="help-content-body">
                <strong>Saving a template:</strong> build a plan the way you want it, open it and click <strong>Save as template</strong> at the bottom of the page. Give it a name (e.g. &quot;Sunday 9.15am&quot;), or choose <strong>Replace an existing template</strong> to update one you already have. Songs in the plan are saved as empty <strong>song slots</strong>; the date and musicians aren&apos;t saved.
              </p>
              <p className="help-content-body">
                <strong>Using a template:</strong> on <strong>New plan</strong>, pick the template under <strong>Start from</strong>, set the date and create the plan. If the template has song slots you&apos;ll go straight into editing it — add your songs and they fill the slots in order.
              </p>
              <p className="help-content-body">
                <strong>Song slots</strong> are placeholders in the running order. While editing a plan you can add one with <strong>+ Song slot</strong> under Other items and give it an optional label such as &quot;Response song&quot;. An empty slot shows as <em>Song to be chosen</em> on the plan, the share link and the email, and you&apos;ll be asked to confirm if you publish while any are still empty.
              </p>
              <p className="help-content-body">
                Changing a template doesn&apos;t affect plans already made from it. Admins can rename, edit or delete templates in <strong>Settings → Plan templates</strong>. Saving templates needs the <strong>Add &amp; edit plans</strong> permission.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      section: 'Your availability',
      topics: [
        {
          id: 'availability',
          title: 'Marking yourself unavailable',
          content: () => (
            <div>
              <p className="help-content-body">
                If you know you&apos;re unavailable for a period — a holiday, a work trip, or anything else — you can log it in Song Stack so your admins know not to schedule you.
              </p>
              <p className="help-content-body">
                Go to <strong>Manage my availability</strong> on the dashboard. Enter a start date, end date, and an optional note, then click <strong>Add</strong>. Your unavailability will be visible to church admins when they&apos;re building plans.
              </p>
              <p className="help-content-body">
                To remove an entry, click the delete button next to it. You can add as many periods as you need.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      section: 'Playlists',
      topics: [
        {
          id: 'playlists',
          title: 'Adding and managing playlists',
          content: () => (
            <div>
              <p className="help-content-body">
                Playlists let you save links to external music resources — a Spotify, YouTube or Apple Music playlist for example — and keep them in one place on your dashboard.
              </p>
              <p className="help-content-body">
                To add a playlist, use the <strong>Playlists</strong> section on the dashboard. Give it a name, paste the URL, and save. Playlists are visible to all church members as a read-only list of links.
              </p>
              <p className="help-content-body">
                Admins and members with the <strong>Manage playlists</strong> permission can add, edit, and delete entries. If you need access and don&apos;t have it, ask an admin to update your permissions on the Team page.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      section: 'Team & permissions',
      topics: [
        {
          id: 'inviting-members',
          title: 'Inviting members',
          content: () => (
            <div>
              <p className="help-content-body">
                Go to the <strong>Team</strong> page and click <strong>Invite member</strong>. Share your church&apos;s invite link directly. Anyone who signs up via that link is automatically connected to your church.
              </p>
              <p className="help-content-body">
                New members join as standard members with no extra permissions. You can adjust their permissions after they&apos;ve joined.
              </p>
            </div>
          ),
        },
        {
          id: 'roles-and-permissions',
          title: 'Roles and permissions',
          content: () => (
            <div>
              <p className="help-content-body">
                There are two roles in Song Stack:
              </p>
              <p className="help-content-body">
                <strong>Admin:</strong> full access to everything, including team management, settings, and all songs and plans. A church always needs at least one admin — if you&apos;re the only admin and other members remain, make someone else an admin from the Team page before you delete your account.
              </p>
              <p className="help-content-body">
                <strong>Member:</strong> read-only access by default, with specific capabilities granted individually.
              </p>
              <p className="help-content-body">
                Admins can grant members the following additional permissions from the Team page:
              </p>
              <p className="help-content-body">
                <strong>Add &amp; edit songs:</strong> can add and edit songs in the library.
              </p>
              <p className="help-content-body">
                <strong>Add &amp; edit plans:</strong> can create new plans and edit the plans they created.
              </p>
              <p className="help-content-body">
                <strong>Manage playlists:</strong> can add, edit, and delete playlist links on the dashboard.
              </p>
              <p className="help-content-body">
                <strong>Add notes to plan items:</strong> can add notes to items in a plan. In the Song Stack iPad app, it also lets them draw shared markings on a PDF — markings the whole church can see (everyone can hide or show them).
              </p>
              <p className="help-content-body">
                To change a member&apos;s role or permissions, go to the <strong>Team</strong> page and click on their name.
              </p>
            </div>
          ),
        },
        {
          id: 'removing-a-member',
          title: 'Removing a member',
          content: () => (
            <div>
              <p className="help-content-body">
                Go to the <strong>Team</strong> page and click on the member you want to remove. At the bottom of their details, click <strong>Remove from church</strong>. You&apos;ll be asked to confirm before anything is deleted.
              </p>
              <p className="help-content-body">
                Removing a member revokes their access to your church&apos;s Song Stack. It doesn&apos;t delete their account — they could join a different church in future if invited.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      section: 'Settings',
      topics: [
        {
          id: 'church-settings',
          title: 'Church name & CCLI number',
          content: () => (
            <div>
              <p className="help-content-body">
                Go to <strong>Settings</strong> to update your church name and CCLI licence number. The church name appears across Song Stack and in exported plans and emails.
              </p>
              <p className="help-content-body">
                Your CCLI number is included in the header of any CCLI usage report you export from the Songs page. If you don&apos;t have a CCLI licence, leave this field blank — you can add it later.
              </p>
            </div>
          ),
        },
        {
          id: 'logo-upload',
          title: 'Logo upload',
          content: () => (
            <div>
              <p className="help-content-body">
                You can upload your church&apos;s logo in <strong>Settings</strong>. This appears on the public plan share page, so musicians who receive a share link see your church branding.
              </p>
              <p className="help-content-body">
                Upload a PNG or JPG. A square or landscape logo works best. There&apos;s no strict size limit but keep it under 1MB for best performance.
              </p>
            </div>
          ),
        },
        {
          id: 'invite-link',
          title: 'Invite link',
          content: () => (
            <div>
              <p className="help-content-body">
                Your church has a unique invite link that you can share with anyone you want to join. Find it on the <strong>Team</strong> page under the invite section.
              </p>
              <p className="help-content-body">
                Anyone who signs up via the link is automatically connected to your church as a standard member.
              </p>
            </div>
          ),
        },
        {
          id: 'service-items',
          title: 'Service items library',
          content: () => (
            <div>
              <p className="help-content-body">
                <strong>Service items</strong> are your church&apos;s reusable non-song service elements — the things that appear in a plan alongside songs. An item can be just a <strong>title</strong> (Welcome, Offering, Notices) or a title with full <strong>content</strong> and a <strong>note</strong> — a prayer, a creed, a call to worship, communion words, a benediction.
              </p>
              <p className="help-content-body">
                Manage them in <strong>Settings → Service items</strong> (admins only). Add an item with a title and, optionally, its full text (with bold and italic) and a note. Items that carry text show a small <strong>text</strong> badge in the list.
              </p>
              <p className="help-content-body">
                When building a plan, your saved service items appear as quick buttons under <strong>Other items</strong>. Adding one drops in a <strong>copy</strong> — so editing it on a plan doesn&apos;t change your library, and editing the library later doesn&apos;t change plans that already use it.
              </p>
            </div>
          ),
        },
        {
          id: 'settings-plan-templates',
          title: 'Plan templates',
          content: () => (
            <div>
              <p className="help-content-body">
                <strong>Settings → Plan templates</strong> lists your church&apos;s templates with how many service items and song slots each has. Click <strong>Edit</strong> to change a template&apos;s name, plan title, start time or pre-service notes, or the <strong>x</strong> to delete it.
              </p>
              <p className="help-content-body">
                Templates are created from a plan, not here: open a plan and use <strong>Save as template</strong>. To change a template&apos;s running order, build it in a plan and save it over the existing template. See <strong>Plans → Plan templates and song slots</strong>.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      section: 'Get help',
      topics: [
        {
          id: 'get-help',
          title: 'Contact & support',
          content: () => <GetHelpContent admins={admins} loading={loading} onShowForm={() => setShowContactForm(true)} showForm={showContactForm} onFormSuccess={() => setShowContactForm('sent')} />,
        },
      ],
    },
  ]

  const allTopics = helpSections.flatMap(s => s.topics)
  const activeTopic = allTopics.find(t => t.id === activeId) ?? allTopics[0]
  const activeContent = activeTopic.content()

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Help &amp; Support</h1>
      </div>

      {/* Mobile topic picker */}
      <div className="help-mobile-select-wrap">
        <select
          className="input help-mobile-select"
          value={activeId}
          onChange={e => setActiveId(e.target.value)}
        >
          {helpSections.map(s => (
            <optgroup key={s.section} label={s.section}>
              {s.topics.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="help-layout">
        {/* Sidebar */}
        <nav className="help-sidebar">
          {helpSections.map(s => {
            const isOpen = openSections.has(s.section)
            return (
              <div key={s.section} className="help-sidebar-section">
                <button
                  className="help-sidebar-heading-btn"
                  onClick={() => toggleSection(s.section, s.topics)}
                  aria-expanded={isOpen}
                >
                  <span>{s.section}</span>
                  <svg
                    className={`help-sidebar-chevron${isOpen ? ' help-sidebar-chevron--open' : ''}`}
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                  >
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {isOpen && (
                  <div className="help-sidebar-items">
                    {s.topics.map(t => (
                      <button
                        key={t.id}
                        className={`help-sidebar-item${activeId === t.id ? ' help-sidebar-item--active' : ''}`}
                        onClick={() => selectTopic(s.section, t.id)}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Content pane */}
        <div className="help-content">
          <h2 className="help-content-title">{activeTopic.title}</h2>
          {activeContent}
        </div>
      </div>
    </div>
  )
}