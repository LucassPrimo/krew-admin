import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function UsuarioAnalyticsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/users/${id}/analytics`)
}
