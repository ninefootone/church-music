'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'
import { PlanTemplatesManager } from '@/components/ui/PlanTemplatesManager'

// Plan templates for admins AND "Add & edit plans" members — the same people the
// backend lets write templates (/api/plan-templates, can_add_plans). Lives under
// Plans rather than Settings because Settings is admin-only. Admins also still
// see the same manager in Settings → Plan templates.
export default function PlanTemplatesPage() {
  const { loading, canAddPlans } = useChurch()

  if (loading) return null

  if (!canAddPlans) {
    return (
      <div className="settings-restricted">
        <p className="settings-restricted-text">Only admins and members who can add &amp; edit plans can manage plan templates.</p>
      </div>
    )
  }

  return (
    <div>
      <Link href="/plans" className="back-link back-link--spaced"><ArrowLeft size={14} /> Back to plans</Link>
      <div className="page-header">
        <h1 className="page-title">Plan templates</h1>
      </div>
      <PlanTemplatesManager />
    </div>
  )
}
