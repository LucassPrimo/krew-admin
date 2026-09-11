import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function Pessoas() {
  redirect('/usuarios')
  return null
}
