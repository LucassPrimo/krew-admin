import { FormularioNovaOferta } from '@/app/(painel)/ofertas/nova/formulario'
import { CrmNav } from '@/components/crm/nav'

export const dynamic = 'force-dynamic'

export default async function NovaOfertaNoCrm({ searchParams }: { searchParams: Promise<{ lead?: string; nome?: string; slug?: string }> }) {
  const { lead, nome, slug } = await searchParams
  return (
    <>
      <CrmNav />
      <FormularioNovaOferta
        leadId={lead}
        nomeInicial={nome ?? ''}
        slugInicial={(slug ?? '').toLowerCase().replace(/[^a-z0-9._-]/g, '')}
      />
    </>
  )
}
