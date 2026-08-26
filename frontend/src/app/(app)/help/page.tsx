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
                You can sign in with an email and password, or with a Google account.
              </p>
              <p className="help-content-body">
                Your account is tied to a church. If you&apos;ve been invited to join a church on Song Stack, follow the invite link in the message you received — this connects your account to that church automatically.
              </p>
              <p className="help-content-body">
                If you need to join a church and don&apos;t have an invite link, ask one of your church admins. They can find the invite link on the Team page.
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
                <strong>Lyrics:</strong> paste lyrics directly. These appear on the song page and public share view.
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
                Once created, you&apos;ll land on the plan detail page where you can add songs, assign musicians, and manage the running order.
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
                Songs appear in the running order in the sequence you add them. You can drag and drop to reorder them using the dots on the left.
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
                The set mode viewer is also available on the public share link, so musicians without a Song Stack account can still access it.
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
                Every plan has a public share link that gives read-only access to the plan details and set mode — no account needed. This is useful for sharing with musicians who aren&apos;t on Song Stack.
              </p>
              <p className="help-content-body">
                Find the share link on the plan detail page. Anyone with the link can view the running order, song keys, arrangements, and files.
              </p>
              <p className="help-content-body">
                The link is unique to each plan and doesn&apos;t expire.
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
                <strong>Admin:</strong> full access to everything, including team management, settings, and all songs and plans.
              </p>
              <p className="help-content-body">
                <strong>Member:</strong> read-only access by default, with specific capabilities granted individually.
              </p>
              <p className="help-content-body">
                Admins can grant members the following additional permissions from the Team page:
              </p>
              <p className="help-content-body">
                <strong>Manage songs:</strong> can add and edit songs in the library.
              </p>
              <p className="help-content-body">
                <strong>Add plans:</strong> can create new plans and edit their own plans.
              </p>
              <p className="help-content-body">
                <strong>Edit any plan:</strong> can edit plans created by other members.
              </p>
              <p className="help-content-body">
                <strong>Manage playlists:</strong> can add, edit, and delete playlist links on the dashboard.
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