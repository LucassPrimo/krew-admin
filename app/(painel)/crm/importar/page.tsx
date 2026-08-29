import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { Aviso } from '@/components/ui'
import { crmInstalado } from '@/lib/crm'
import { escritaLigada } from '@/lib/env'
import { Importador } from './importador'

export const dynamic = 'force-dynamic'

/**
 * Importar a planilha de leads.
 *
 * Tela própria e não um botão na lista: importação tem dois passos (conferir,
 * então gravar) e uma prévia que pode ter centenas de linhas. Espremer isso
 * num painel sobre a lista faria a conferência — que é a parte que evita o
 * engano — virar a parte que se pula.
 */
export default async function ImportarLeads() {
  const instalado = await crmInstalado()

  return (
    <div className="max-w-5xl">
      <Link
        href="/crm"
        className="mb-3 inline-flex items-center gap-1 text-xs text-texto-fraco hover:text-texto"
      >
        <ChevronLeft className="size-3.5" strokeWidth={1.5} />
        CRM
      </Link>

      <h1 className="mb-1 text-lg font-medium">Importar planilha</h1>
      <p className="mb-4 max-w-2xl text-xs text-texto-fraco">
        Cole direto do Google Sheets ou escolha um arquivo CSV. O painel confere
        tudo e mostra o que vai acontecer com cada linha antes de gravar
        qualquer coisa.
      </p>

      {!instalado ? (
        <Aviso tom="perigo">
          O schema <code className="font-mono">admin_crm</code> ainda não existe neste
          banco. Rode <code className="font-mono">sql/admin_crm.sql</code> no SQL Editor
          do Supabase antes de importar.
        </Aviso>
      ) : (
        <Importador podeEscrever={escritaLigada} />
      )}
    </div>
  )
}
