export type Role = 'admin' | 'member'

export type TemplateStatus = 'pending' | 'approved' | 'rejected'

export type FileType = 'chords' | 'lead' | 'vocal' | 'full_score'

export type Category =
  | 'praise'
  | 'confession'
  | 'assurance'
  | 'communion'
  | 'lament'
  | 'response'
  | 'sending'

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'praise',     label: 'Praise' },
  { value: 'confession', label: 'Confession' },
  { value: 'assurance',  label: 'Assurance' },
  { value: 'communion',  label: 'Communion' },
  { value: 'lament',     label: 'Lament' },
  { value: 'response',   label: 'Response' },
  { value: 'sending',    label: 'Sending' },
]

export interface Church {
  id: string
  name: string
  slug: string
  invite_code: string
  created_at: string
}

export interface User {
  id: string
  clerk_id: string
  email: string
  name: string
  created_at: string
}

export interface Membership {
  id: string
  church_id: string
  user_id: string
  role: Role
  joined_at: string
  user?: User
}

export interface SongFile {
  id: string
  song_id: string
  file_type: FileType
  label: string
  key_of: string | null
  r2_key: string
  url?: string
  uploaded_at: string
}

export interface Song {
  id: string
  church_id: string | null
  title: string
  author: string
  default_key: string
  category: Category
  first_line: string | null
  lyrics: string | null
  ccli_number: string | null
  youtube_url: string | null
  is_template: boolean
  template_status: TemplateStatus | null
  contributed_by: string | null
  created_at: string
  tags?: string[]
  files?: SongFile[]
  usage?: {
    times_sung: number
    times_planned: number
    last_sung: string | null
  }
  recent_services?: {
    id: string
    date: string
    key_used: string | null
    service_time: string | null
  }[]
}

export interface ServiceItem {
  id: string
  service_id: string
  type: 'song' | 'reading' | 'prayer' | 'sermon' | 'confession' | 'welcome' | 'custom'
  song_id: string | null
  title: string | null
  notes: string | null
  key_override: string | null
  position: number
  song?: Song
}

export interface Service {
  id: string
  church_id: string
  service_date: string
  service_time: string | null
  title: string | null
  public_token: string
  created_at: string
  items?: ServiceItem[]
}

export interface StatsData {
  top_songs: {
    song_id: string
    title: string
    author: string
    category: Category
    count: number
    last_sung: string
  }[]
  total_services: number
  total_songs: number
  period_days: number
}
