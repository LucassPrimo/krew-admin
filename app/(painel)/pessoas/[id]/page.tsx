import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PessoaRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/users/${id}`)
  return null
}
