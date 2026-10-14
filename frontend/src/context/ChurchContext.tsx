'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import api, { setAuthToken, setChurchId, registerTokenRefresher } from '@/lib/api'
import { getRememberedChurchId, rememberChurchId } from '@/lib/activeChurch'

interface Church {
  id: string
  name: string
  slug: string
  invite_code: string
  ccli_number: string | null
  logo_url: string | null
  role: 'admin' | 'member'
  subscription_status: 'free' | 'active' | 'trialing' | 'past_due' | 'canceled' | null
  free_access: boolean | null
  can_manage_songs: boolean
  can_add_plans: boolean
  can_manage_playlists: boolean
  can_annotate_plans: boolean
}

interface ChurchContextType {
  church: Church | null
  churches: Church[]
  loading: boolean
  isAdmin: boolean
  canManageSongs: boolean
  canAddPlans: boolean
  canManagePlaylists: boolean
  canAnnotatePlans: boolean
  refetch: () => void
  switchChurch: (churchId: string) => void
}

const ChurchContext = createContext<ChurchContextType>({
  church: null, churches: [], loading: true, isAdmin: false, canManageSongs: false, canAddPlans: false, canManagePlaylists: false, canAnnotatePlans: false, refetch: () => {}, switchChurch: () => {},
})

// Pick the church to work in from the user's memberships (sorted by name by the API):
// 1. ?church=<id> in the URL, if they belong to it (lets a link open the right church),
// 2. the church they last chose on this browser,
// 3. otherwise the first one.
function pickChurch(churches: Church[]): Church {
  let fromUrl: string | null = null
  try {
    fromUrl = new URLSearchParams(window.location.search).get('church')
  } catch {}
  const wanted = [fromUrl, getRememberedChurchId()]
  for (const id of wanted) {
    const match = id && churches.find(c => c.id === id)
    if (match) return match
  }
  return churches[0]
}

export function ChurchProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [church, setChurch] = useState<Church | null>(null)
  const [churches, setChurches] = useState<Church[]>([])
  const [loading, setLoading] = useState(true)

  // Register token refresher so api interceptor can auto-retry on 401
  useEffect(() => {
    registerTokenRefresher(async () => {
      const token = await getToken()
      if (token) setAuthToken(token)
      return token
    })
  }, [getToken])

  const fetchChurch = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false)
      return
    }
    try {
      const token = await getToken()
      if (!token) { setLoading(false); return }
      setAuthToken(token)
      const { data } = await api.get('/api/churches/mine')
      if (data && data.length > 0) {
        const c = pickChurch(data)
        rememberChurchId(c.id)
        setChurchId(c.id)
        setChurches(data)
        setChurch(c)
        if (pathname === '/onboarding') router.push('/dashboard')
      } else {
        if (pathname !== '/onboarding') router.push('/onboarding')
      }
    } catch (err) {
      console.error('Failed to fetch church:', err)
    } finally {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, pathname])

  useEffect(() => {
    if (isLoaded) fetchChurch()
  }, [isLoaded, isSignedIn])

  // Switching church is a full page load to the dashboard, not a state change: every page
  // holds data it fetched for the old church (and the URL may be an old-church plan or song),
  // so a clean reload is the only way to be sure nothing from the previous church lingers.
  const switchChurch = useCallback((churchId: string) => {
    if (churchId === church?.id) return
    rememberChurchId(churchId)
    window.location.assign('/dashboard')
  }, [church?.id])

  return (
    <ChurchContext.Provider value={{
      church, churches, loading,
      isAdmin: church?.role === 'admin',
      canManageSongs: church?.role === 'admin' || !!church?.can_manage_songs,
      canAddPlans: church?.role === 'admin' || !!church?.can_add_plans,
      canManagePlaylists: church?.role === 'admin' || !!church?.can_manage_playlists,
      canAnnotatePlans: church?.role === 'admin' || !!church?.can_annotate_plans,
      refetch: fetchChurch,
      switchChurch,
    }}>
      {children}
    </ChurchContext.Provider>
  )
}

export function useChurch() {
  return useContext(ChurchContext)
}
