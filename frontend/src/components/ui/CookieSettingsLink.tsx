'use client'

export default function CookieSettingsLink() {
  function open() {
    window.dispatchEvent(new Event('open-cookie-settings'))
  }

  return (
    <button onClick={open} className="footer-link cookie-settings-btn">
      Cookie settings
    </button>
  )
}