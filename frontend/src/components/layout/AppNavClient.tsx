'use client'

import { useChurch } from '@/context/ChurchContext'
import { AppNav } from './AppNav'

export function AppNavClient() {
  const { church, loading } = useChurch()
  const churchName = loading ? '...' : (church?.name || 'My Church')
  return <AppNav churchName={churchName} />
}
