import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function UsuariosRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => query.append(key, v))
    else if (value) query.set(key, value)
  }
  redirect(`/users${query.size ? `?${query}` : ''}`)
}
