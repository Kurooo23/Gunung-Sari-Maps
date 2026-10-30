import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Beberapa browser/WebView di HP menegakkan Trusted Types meski CSP kita
// sendiri gak eksplisit mewajibkannya. Leaflet (peta) menulis beberapa
// elemen (popup, tooltip, kontrol) lewat innerHTML mentah di baliknya --
// tanpa policy default, itu bikin "Uncaught TypeError: ... requires
// 'TrustedHTML' assignment" dan peta gagal render total di device tsb.
// Policy default di sini cuma meneruskan string apa adanya (kita sendiri
// yang menyusun HTML popup/tooltipnya, bukan input pengguna), supaya
// assignment innerHTML lama tetap jalan seperti biasa di semua device.
if (typeof window !== 'undefined' && window.trustedTypes?.createPolicy) {
  try {
    window.trustedTypes.createPolicy('default', {
      createHTML: (htmlString) => htmlString,
      createScript: (scriptContent) => scriptContent,
      createScriptURL: (scriptUrl) => scriptUrl,
    })
  } catch {
    // Policy 'default' udah pernah dibuat (mis. oleh script lain) -- aman
    // diabaikan, gak perlu bikin ulang.
  }
}

// Muat stylesheet Google Fonts secara non-blocking (menggantikan trik
// media="print" onload="this.media='all'" yang butuh inline script handler
// -- itu ditolak oleh Content-Security-Policy script-src 'self').
const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500;1,600&family=Inter:wght@400;500;600;700&display=swap'
document.head.appendChild(fontLink)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
