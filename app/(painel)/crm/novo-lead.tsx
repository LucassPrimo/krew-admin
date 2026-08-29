'use client'

import { Loader2, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { ESTAGIOS_MANUAIS, ROTULO, type EstagioManual } from '@/lib/crm-tipos'
import { acaoCriarLead } from './acoes'

/**
 * O cadastro de um lead, num painel que abre acima da lista.
 *
 * Um formulário e não uma rota própria: cadastrar lead é o gesto mais repetido
 * da tela — dez seguidos, colando de uma conversa — e uma navegação de ida e
 * volta a cada um transformaria isso em trabalho.
 *
 * O único campo obrigatório é o nome. Instagram, fonte e handle são o que você
 * costuma ter na mão, mas exigi-los faria você inventar valor para conseguir
 * salvar — que é como uma planilha ganha "?" e "a confirmar" nas colunas.
 */

const CAMPO =
  'h-9 w-full rounded-lg border border-borda bg-fundo px-3 text-sm outline-none focus:border-acento'

export function NovoLeadBotao({
  desabilitado, fontes = [],
}: {
  desabilitado?: boolean
  /** As fontes que já existem, para a lista de sugestão. */
  fontes?: string[]
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [instagram, setInstagram] = useState('')
  const [fonte, setFonte] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [estagio, setEstagio] = useState<EstagioManual>('novo')
  const [proximo, setProximo] = useState('')
  const [nota, setNota] = useState('')

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await acaoCriarLead({
        nome, instagram, fonte, email, whatsapp,
        handlePretendido: handle, proximoContato: proximo || null, estagio, nota,
      })
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      // Direto para a ficha: quem acabou de cadastrar quase sempre tem algo a
      // anotar sobre a pessoa, e é lá que isso mora.
      router.push(`/crm/${r.id}`)
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <button
        type="button" disabled={desabilitado} onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-fundo disabled:opacity-40"
      >
        <Plus className="size-4" />
        Novo lead
      </button>
    )
  }

  return (
    <div className="w-full rounded-lg border border-borda bg-painel p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium">Nome</span>
          <input
            autoFocus value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="Como você chama a pessoa" className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Instagram</span>
          <input
            value={instagram} onChange={(e) => setInstagram(e.target.value)}
            placeholder="@ ou o link do perfil" className={`${CAMPO} font-mono text-xs`}
          />
          <span className="text-[11px] text-texto-fraco">
            O @ é a identidade do lead: o painel recusa um segundo com o mesmo.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Fonte</span>
          <input
            value={fonte} onChange={(e) => setFonte(e.target.value)} list="crm-fontes"
            placeholder="Link School, Adam, indicação…" className={CAMPO}
          />
          <datalist id="crm-fontes">
            {fontes.map((f) => <option key={f} value={f} />)}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Handle pretendido</span>
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs text-texto-fraco">bekrew.com/@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
              placeholder="nomedocriador" className={`${CAMPO} font-mono text-xs`}
            />
          </div>
          <span className="text-[11px] text-texto-fraco">
            Se a oferta com esse handle já existe, o lead nasce vinculado a ela.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Estágio</span>
          <select
            value={estagio} onChange={(e) => setEstagio(e.target.value as EstagioManual)}
            className={CAMPO}
          >
            {ESTAGIOS_MANUAIS.map((e) => <option key={e} value={e}>{ROTULO[e]}</option>)}
          </select>
          <span className="text-[11px] text-texto-fraco">
            Daqui para a frente o estágio vem da oferta, sozinho.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">E-mail</span>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="para onde o convite vai depois" className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">WhatsApp</span>
          <input
            value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="com DDD" className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Próximo contato</span>
          <input
            type="date" value={proximo} onChange={(e) => setProximo(e.target.value)}
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium">Primeira anotação</span>
          <textarea
            rows={2} value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder="Como você chegou nessa pessoa, o que já foi dito"
            className="w-full resize-none rounded-lg border border-borda bg-fundo px-3 py-2 text-sm outline-none focus:border-acento"
          />
        </label>
      </div>

      {erro && (
        <p className="mt-3 rounded-lg border border-perigo/40 bg-perigo-fundo px-3 py-2 text-sm text-perigo">
          {erro}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button" onClick={salvar} disabled={pendente || !nome.trim()}
          className="flex items-center gap-1.5 rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-fundo disabled:opacity-40"
        >
          {pendente && <Loader2 className="size-3.5 animate-spin" />}
          Salvar lead
        </button>
        <button
          type="button" onClick={() => setAberto(false)}
          className="text-sm text-texto-fraco hover:text-texto"
        >
          cancelar
        </button>
      </div>
    </div>
  )
}
