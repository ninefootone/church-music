'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import api, { setAuthToken } from '@/lib/api'

interface Church {
  id: string
  name: string
  slug: string
  invite_code: string
  role: 'admin' | 'member'
}

interface ChurchContextType {
  church: Church | null
  loading: boolean
  isAdmin: boolean
  refetch: () => void
}

const ChurchContext = createContext<ChurchContextType>({
  church: null,
  loading: true,
  isAdmin: false,
  refetch: () => {},
})

export function ChurchProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [church, setChurch] = useState<Church | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchChurch = async () => {
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
        setChurch(c)
        api.defaults.headers.common['x-church-id'] = c.id
        // If on onboarding but already have a church, redirect to dashboard
        if (pathname === '/onboarding') {
          router.push('/dashboard')
        }
      } else {
        // No church — redirect to onboarding unless already there
        if (pathname !== '/onboarding') {
          router.push('/onboarding')
        }
      }
    } catch (err) {
      console.error('Failed to fetch church:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoaded) fetchChurch()
  }, [isLoaded, isSignedIn])

  return (
    <ChurchContext.Provider value={{ church, loading, isAdmin: church?.role === 'admin', refetch: fetchChurch }}>
      {children}
    </ChurchContext.Provider>
  )
}

export function useChurch() {
  return useContext(ChurchContext)
}
