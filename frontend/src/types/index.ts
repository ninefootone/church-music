export type Role = 'admin' | 'member'
export type TemplateStatus = 'pending' | 'approved' | 'rejected'
export type FileType = 'chords' | 'lead' | 'vocal' | 'full_score'

export type Category =
  | 'praise'
  | 'assurance'
  | 'response'
  | 'communion'
  | 'lament'
  | 'easter'
  | 'christmas'
  | 'all_age'
  | 'other'

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'praise',     label: 'Praise' },
  { value: 'assurance',  label: 'Assurance' },
  { value: 'response',   label: 'Response' },
  { value: 'communion',  label: 'Communion' },
  { value: 'lament',     label: 'Lament' },
  { value: 'easter',     label: 'Easter' },
  { value: 'christmas',  label: 'Christmas' },
  { value: 'all_age',    label: 'All-age' },
  { value: 'other',      label: 'Other' },
]

export interface Church {
  id: string
  name: string
  slug: string
  invite_code: string
  role: 'admin' | 'member'
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
  name?: string
  email?: string
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
  ccli_url: string | null
  notes: string | null
  bible_references: string | null
  suggested_arrangement: string | null
  videos?: {
    id: string
    url: string
    label: string | null
    sort_order: number
  }[]
  is_template: boolean
  template_status: TemplateStatus | null
  contributed_by: string | null
  created_at: string
  last_sung?: string | null
  next_planned?: string | null
  tags?: string[]
  files?: SongFile[]
  usage?: {
    times_sung: number
    times_planned: number
    last_sung: string | null
  }
  recent_services?: {
    id: string
    service_date: string
    key_override: string | null
    service_time: string | null
  }[]
}

export interface ServiceItem {
  id: string
  service_id: string
  type: string
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
