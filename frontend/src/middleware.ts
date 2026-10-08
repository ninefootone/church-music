import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/s(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Signed-in users have no reason to see sign-up — send them to the app.
  // Exact path only, so Clerk's own sub-steps (/sign-up/sso-callback etc.) are untouched.
  if (req.nextUrl.pathname === '/sign-up') {
    const { userId } = await auth()
    if (userId) return NextResponse.redirect(new URL('/dashboard', req.url))
  }
  if (!isPublicRoute(req)) {
    await auth()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
