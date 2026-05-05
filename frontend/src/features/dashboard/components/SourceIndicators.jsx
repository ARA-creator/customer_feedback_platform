import {
  FaXTwitter,
  FaTwitter,
  FaWhatsapp,
  FaInstagram,
  FaFacebook,
  FaGlobe,
  FaEnvelope,
  FaTiktok,
  FaGoogle,
} from 'react-icons/fa6'

export function SourceLogo({ source }) {
  const s = String(source || '').toLowerCase()
  const className = 'h-4 w-4'

  const brand = {
    whatsapp: '#25D366',
    instagram: '#E1306C',
    facebook: '#1877F2',
    tiktok: '#00F2EA',
    google_forms: '#4285F4',
    email: '#6B7280',
    web: '#0EA5E9',
    x: '#111827',
    twitter: '#1D9BF0',
    channel: '#6B7280',
  }

  if (s.includes('whatsapp')) return <FaWhatsapp className={className} style={{ color: brand.whatsapp }} aria-label="WhatsApp" />
  if (s.includes('instagram')) return <FaInstagram className={className} style={{ color: brand.instagram }} aria-label="Instagram" />
  if (s.includes('facebook')) return <FaFacebook className={className} style={{ color: brand.facebook }} aria-label="Facebook" />
  if (s.includes('tiktok')) return <FaTiktok className={className} style={{ color: brand.tiktok }} aria-label="TikTok" />
  if (s.includes('google')) return <FaGoogle className={className} style={{ color: brand.google_forms }} aria-label="Google Forms" />
  if (s === 'email' || s.includes('mail')) return <FaEnvelope className={className} style={{ color: brand.email }} aria-label="Email" />
  if (s === 'web' || s.includes('web')) return <FaGlobe className={className} style={{ color: brand.web }} aria-label="Web" />
  if (s === 'x' || s.includes('x_') || s.includes('x-') || s.includes('x ')) return <FaXTwitter className={className} style={{ color: brand.x }} aria-label="X" />
  if (s.includes('twitter')) return <FaTwitter className={className} style={{ color: brand.twitter }} aria-label="Twitter" />

  return <FaGlobe className={className} style={{ color: brand.channel }} aria-label="Channel" />
}

export function SourceAxisTick({ x, y, payload }) {
  const value = payload?.value
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-22} y={-10} width={20} height={20}>
        <div xmlns="http://www.w3.org/1999/xhtml" className="flex items-center justify-center">
          <SourceLogo source={value} />
        </div>
      </foreignObject>
    </g>
  )
}

export function SourcePill({ source }) {
  if (!source) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
      <SourceLogo source={source} />
      <span className="capitalize">{String(source).replace(/_/g, ' ')}</span>
    </span>
  )
}
