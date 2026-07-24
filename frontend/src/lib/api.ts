import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
})

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

export function setChurchId(churchId: string) {
  api.defaults.headers.common['x-church-id'] = churchId
}

// Store a token refresher function that ChurchContext can register
let tokenRefresher: (() => Promise<string | null>) | null = null

export function registerTokenRefresher(fn: () => Promise<string | null>) {
  tokenRefresher = fn
}

// Request interceptor: mint a fresh token before every request so no call site
// can send a stale one. getToken() is cheap — Clerk returns its cached token and
// only hits the network when it's actually near expiry. Skipped when no refresher
// is registered (signed-out/public pages), so those requests go through unauthenticated.
api.interceptors.request.use(async config => {
  if (tokenRefresher) {
    try {
      const token = await tokenRefresher()
      if (token) config.headers['Authorization'] = `Bearer ${token}`
    } catch (err) {
      console.error('Token refresh (request interceptor) failed:', err)
    }
  }
  return config
})

// Interceptor: on 401, try refreshing the token once then retry
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry && tokenRefresher) {
      originalRequest._retry = true
      try {
        const newToken = await tokenRefresher()
        if (newToken) {
          setAuthToken(newToken)
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
      }
    }
    return Promise.reject(error)
  }
)

export default api
