export function fmt(n: number) {
  return (n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function fmtDate(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const day = d.getDate()
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtTime(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function fmtDateTime(iso: string) {
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}

export function toWaPhone(phone: string): string {
  const c = phone.replace(/\D/g, '')
  if (c.startsWith('254')) return c
  if (c.startsWith('0') && c.length >= 10) return '254' + c.slice(1)
  if (c.startsWith('7') && c.length === 9) return '254' + c
  return c
}
