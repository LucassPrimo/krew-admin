'use client'

import { Loader2, Plus, Upload, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { ESTAGIOS_MANUAIS, ROTULO, type EstagioManual } from '@/lib/crm-tipos'
import { acaoCriarLead } from './acoes'

/**
 * O título da tela e o cadastro de lead, no mesmo componente.
 *
 * Juntos porque o formulário abre ABAIXO do título e o botão que o abre fica
 * dentro dele — dois componentes exigiriam levantar esse estado para a página,
 * que é Server Component. Antes o formulário ia no `acao` do `<Titulo>`, que é
 * um flex de uma linha: ele nascia espremido ao lado do h1.
 *
 * É painel e não rota própria porque cadastrar lead é o gesto mais repetido da
 * tela — dez seguidos, colando de uma conversa —, e uma navegação de ida e
 * volta a cada um transformaria isso em trabalho.
 */

const CAMPO =
  'h-9 w-full rounded-lg border border-borda bg-fundo px-3 text-sm outline-none transition-colors focus:border-borda-forte'

function Rotulo({ children, dica }: { children: React.ReactNode; dica?: string }) {
  return (
    <span className="text-xs font-medium text-texto">
      {children}
      {dica && <span className="ml-1.5 font-normal text-texto-fraco">{dica}</span>}
    </span>
  )
}

export function Cabecalho({
  podeCriar, fontes,
}: {
  podeCriar: boolean
  /** As fontes que já existem, para a lista de sugestão. */
  fontes: string[]
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

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-medium">CRM de prospecção</h1>
        {!aberto && (
          <div className="flex items-center gap-2">
            {/* Importar vem ANTES na leitura e depois na ordem visual: é o que
                você faz uma vez, na mudança da planilha, e o cadastro avulso é
                o de todo dia. */}
            <Link
              href="/crm/importar"
              className="flex items-center gap-1.5 rounded-md border border-borda px-3 py-1.5 text-sm text-texto-fraco transition-colors hover:border-borda-forte hover:text-texto"
            >
              <Upload className="size-4" strokeWidth={1.5} />
              Importar planilha
            </Link>
            <button
              type="button" disabled={!podeCriar} onClick={() => setAberto(true)}
              className="flex items-center gap-1.5 rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-fundo disabled:opacity-40"
            >
              <Plus className="size-4" strokeWidth={2} />
              Novo lead
            </button>
          </div>
        )}
      </div>

      {aberto && (
        <div className="animate-in mb-4 rounded-lg border border-borda bg-painel p-4">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium">Novo lead</h2>
              <p className="text-xs text-texto-fraco">
                Só o nome é obrigatório — exigir o resto faria você inventar
                valor para conseguir salvar, que é como uma planilha ganha
                &ldquo;?&rdquo; e &ldquo;a confirmar&rdquo; nas colunas.
              </p>
            </div>
            <button
              type="button" onClick={() => setAberto(false)}
              aria-label="Fechar" className="text-texto-fraco hover:text-texto"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1.5 lg:col-span-1">
              <Rotulo>Nome</Rotulo>
              <input
                autoFocus value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder="Como você chama a pessoa" className={CAMPO}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <Rotulo dica="a identidade do lead">Instagram</Rotulo>
              <input
                value={instagram} onChange={(e) => setInstagram(e.target.value)}
                placeholder="@ ou o link do perfil" className={`${CAMPO} font-mono text-xs`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <Rotulo>Fonte</Rotulo>
              <input
                value={fonte} onChange={(e) => setFonte(e.target.value)} list="crm-fontes"
                placeholder="Link School, Adam, indicação…" className={CAMPO}
              />
              <datalist id="crm-fontes">
                {fontes.map((f) => <option key={f} value={f} />)}
              </datalist>
            </label>

            <label className="flex flex-col gap-1.5">
              <Rotulo dica="vincula sozinho se já existir">Handle da bio</Rotulo>
              <div className="flex h-9 items-center rounded-lg border border-borda bg-fundo pl-3 focus-within:border-borda-forte">
                <span className="shrink-0 font-mono text-xs text-texto-fraco">bekrew.com/@</span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  placeholder="nomedocriador"
                  className="h-full w-full bg-transparent pr-3 font-mono text-xs outline-none placeholder:text-texto-fraco"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <Rotulo>E-mail</Rotulo>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="para onde o convite vai depois" className={CAMPO}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <Rotulo>WhatsApp</Rotulo>
              <input
                value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="com DDD" className={CAMPO}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <Rotulo dica="depois vem da oferta">Estágio</Rotulo>
              <select
                value={estagio} onChange={(e) => setEstagio(e.target.value as EstagioManual)}
                className={CAMPO}
              >
                {ESTAGIOS_MANUAIS.map((e) => <option key={e} value={e}>{ROTULO[e]}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <Rotulo>Próximo contato</Rotulo>
              <input
                type="date" value={proximo} onChange={(e) => setProximo(e.target.value)}
                className={CAMPO}
              />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
              <Rotulo>Primeira anotação</Rotulo>
              <textarea
                rows={1} value={nota} onChange={(e) => setNota(e.target.value)}
                placeholder="Como você chegou nessa pessoa"
                className="min-h-9 w-full resize-y rounded-lg border border-borda bg-fundo px-3 py-2 text-sm outline-none transition-colors focus:border-borda-forte"
              />
            </label>
          </div>

          {erro && (
            <p className="mt-3 rounded-lg border border-perigo/40 bg-perigo-fundo px-3 py-2 text-sm text-perigo">
              {erro}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3 border-t border-borda pt-3">
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
      )}
    </>
  )
}
