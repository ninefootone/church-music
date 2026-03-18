'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'
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
  const { getToken, isSignedIn } = useAuth()
  const [church, setChurch] = useState<Church | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchChurch = async () => {
    if (!isSignedIn) {
      setLoading(false)
      return
    }

    try {
      const token = await getToken()
      setAuthToken(token)

      const { data } = await api.get('/api/churches/mine')
      if (data && data.length > 0) {
        const c = data[0]
        setChurch(c)
        // Set church ID header for all future requests
        api.defaults.headers.common['x-church-id'] = c.id
      }
    } catch (err) {
      console.error('Failed to fetch church:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChurch()
  }, [isSignedIn])

  return (
    <ChurchContext.Provider value={{
      church,
      loading,
      isAdmin: church?.role === 'admin',
      refetch: fetchChurch,
    }}>
      {children}
    </ChurchContext.Provider>
  )
}

export function useChurch() {
  return useContext(ChurchContext)
}
