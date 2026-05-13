import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="auth-shell">
      <div className="auth-header">
        <img src="/logo.svg" alt="Song Stack" className="auth-logo" />
        <div className="auth-tagline">Create your account to get started</div>
      </div>
      <SignUp />
    </div>
  )
}