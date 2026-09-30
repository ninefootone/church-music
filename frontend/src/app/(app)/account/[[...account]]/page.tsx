import { UserProfile } from '@clerk/nextjs'
import DeleteAccountSection from '@/components/DeleteAccountSection'

// Account page — Clerk's hosted profile: name, photo, email addresses, password, and connected sign-in methods
// (Google / Apple). The backend copies the Clerk name into users.name on every authenticated request
// (middleware/auth.js requireAuth), so a changed name shows on the Team page straight away.
export default function AccountPage() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 40px' }}>
        <UserProfile path="/account" routing="path" />
      </div>
      <DeleteAccountSection />
    </>
  )
}
