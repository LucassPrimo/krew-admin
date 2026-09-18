import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function Pessoas() {
  redirect('/users')
  return null
}
