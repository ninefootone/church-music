'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import api, { setAuthToken, setChurchId, registerTokenRefresher } from '@/lib/api'

interface Church {
  id: string
  name: string
  slug: string
  invite_code: string
  ccli_number: string | null
  logo_url: string | null
  role: 'admin' | 'member'
  subscription_status: 'free' | 'active' | 'trialing' | 'past_due' | 'canceled' | null
  can_manage_songs: boolean
  can_add_plans: boolean
  can_manage_playlists: boolean
  can_annotate_plans: boolean
}

interface ChurchContextType {
  church: Church | null
  loading: boolean
  isAdmin: boolean
  canManageSongs: boolean
  canAddPlans: boolean
  canManagePlaylists: boolean
  canAnnotatePlans: boolean
  refetch: () => void
}

const ChurchContext = createContext<ChurchContextType>({
  church: null, loading: true, isAdmin: false, canManageSongs: false, canAddPlans: false, canManagePlaylists: false, canAnnotatePlans: false, refetch: () => {},
})

export function ChurchProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [church, setChurch] = useState<Church | null>(null)
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
        const c = data[0]
        setChurchId(c.id)
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

  return (
    <ChurchContext.Provider value={{
      church, loading,
      isAdmin: church?.role === 'admin',
      canManageSongs: church?.role === 'admin' || !!church?.can_manage_songs,
      canAddPlans: church?.role === 'admin' || !!church?.can_add_plans,
      canManagePlaylists: church?.role === 'admin' || !!church?.can_manage_playlists,
      canAnnotatePlans: church?.role === 'admin' || !!church?.can_annotate_plans,
      refetch: fetchChurch,
    }}>
      {children}
    </ChurchContext.Provider>
  )
}

export function useChurch() {
  return useContext(ChurchContext)
}
