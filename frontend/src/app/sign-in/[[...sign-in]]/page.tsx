import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="auth-shell">
      <div className="auth-header">
        <img src="/logo.svg" alt="Song Stack" className="auth-logo" />
        <div className="auth-tagline">Song library and worship plan management for churches</div>
      </div>
      <SignIn />
    </div>
  )
}