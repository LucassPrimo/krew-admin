'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Tag } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

import { BotaoSalvar } from '@/components/ui/campos'
import { Secao } from '@/components/ui/secao'
import type { PerfilLinkme } from '@/lib/importar-linkme'
import { acaoVincularOferta } from '@/app/(painel)/crm/acoes'
import { acaoCriarOferta, acaoImportarLinkme, verificarSlug } from '../acoes'

/**
 * Criar a página — passo 1 de 2.
 *
 * Esta tela pede o MÍNIMO para a página existir: o endereço e o nome. Todo o
 * resto (capa, bio, cor, links, formato dos cards) é editado no passo 2, onde
 * a prévia é um iframe da página publicada de verdade.
 *
 * A divisão existe por causa da prévia. Enquanto tudo era editado aqui, não
 * havia página para carregar num iframe e a única saída era uma maquete
 * reconstruída — que divergiria do produto real na primeira mudança de layout.
 * Criando primeiro, a prévia deixa de ser aproximação: é a página.
 *
 * Importar continua trazendo TUDO de uma vez. O que a importação preenche não
 * aparece aqui — vai direto para a página criada, e você revisa no editor com a
 * prévia ao lado, que é onde dá para ver se ficou bom.
 *
 * Os valores iniciais vêm por PROP, de um Server Component que lê a URL. Quem
 * chega do CRM traz o lead, o nome e o handle já anotados lá — e é o `leadId`
 * que fecha o ciclo: criada a página, ela é vinculada ao lead antes do
 * redirecionamento, e o estágio dele passa a ser lido da oferta sozinho.
 */
export function FormularioNovaOferta({
  leadId, nomeInicial = '', slugInicial = '',
}: {
  leadId?: string
  nomeInicial?: string
  slugInicial?: string
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [origem, setOrigem] = useState('')
  const [perfil, setPerfil] = useState<PerfilLinkme | null>(null)
  const [slug, setSlug] = useState(slugInicial)
  const [slugStatus, setSlugStatus] = useState<{ livre: boolean; porque?: string } | null>(null)
  const [nome, setNome] = useState(nomeInicial)

  // O handle que veio do lead é conferido sozinho: quem clicou "Criar a oferta"
  // lá já escolheu esse endereço, e descobrir que ele está ocupado só depois de
  // preencher o resto seria descobrir tarde demais.
  useEffect(() => {
    if (slugInicial) verificarSlug(slugInicial).then(setSlugStatus)
  }, [slugInicial])

  function conferirSlug(valor: string) {
    const limpo = valor.trim().toLowerCase()
    if (!limpo) return
    verificarSlug(limpo).then(setSlugStatus)
  }

  function importar() {
    setErro(null)
    setImportando(true)
    startTransition(async () => {
      const r = await acaoImportarLinkme(origem)
      setImportando(false)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setPerfil(r.perfil)
      setNome(r.perfil.nome ?? '')
      if (r.perfil.handle) {
        setSlug(r.perfil.handle)
        conferirSlug(r.perfil.handle)
      }
    })
  }

  function criar(form: FormData) {
    setErro(null)
    startTransition(async () => {
      const r = await acaoCriarOferta(form)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      // O vínculo com o lead vai ANTES da navegação e sem interromper o
      // fluxo se falhar: a página já existe, e prender a pessoa numa tela de
      // erro por causa de um ponteiro do CRM seria perder o passo importante
      // por causa do acessório. A ficha do lead permite vincular à mão.
      if (leadId) await acaoVincularOferta(leadId, r.pageId)

      // Direto para o editor, e não para a lista: a página acabou de nascer e
      // o que você quer agora é ver como ela ficou.
      router.push(`/ofertas/${r.pageId}`)
      router.refresh()
    })
  }

  const campo =
    'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary'

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-medium">Nova oferta de bio</h1>
          <p className="text-xs text-muted-foreground">
            Passo 1 de 2 — criar a página. O resto você preenche no editor, com
            a prévia real ao lado.
          </p>
        </div>
        <Link href="/ofertas" className="text-sm text-muted-foreground hover:text-foreground">
          voltar
        </Link>
      </div>

      <form action={criar} className="flex flex-col gap-3">
        {/* O que a importação trouxe vai inteiro para a criação, mesmo sem
            aparecer nesta tela. */}
        <input type="hidden" name="redes" value={JSON.stringify(perfil?.redes ?? [])} />
        <input type="hidden" name="links" value={JSON.stringify(perfil?.links ?? [])} />
        <input type="hidden" name="headline" value={perfil?.bio ?? ''} />
        <input type="hidden" name="avatar_url" value={perfil?.avatarUrl ?? ''} />
        <input type="hidden" name="notas" value={perfil ? `Importado de link.me/${perfil.handle}` : ''} />

        <section className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">Importar de um link.me</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Traz nome, foto, bio, redes e todos os links — com a arte e o
            formato de cada card.
          </p>
          <div className="flex gap-2">
            <input
              value={origem} onChange={(e) => setOrigem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); importar() } }}
              placeholder="jasonderulo  ou  https://link.me/jasonderulo"
              className={campo}
            />
            <button
              type="button" onClick={importar} disabled={importando || !origem.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {importando
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Download className="size-3.5" />}
              Importar
            </button>
          </div>
          {perfil && (
            <p className="mt-2 text-xs text-muted-foreground">
              {perfil.redes.length} rede(s) e {perfil.links.length} link(s) prontos para entrar.
              {perfil.avisos.map((a) => (
                <span key={a} className="mt-1 block text-aviso">{a}</span>
              ))}
            </p>
          )}
        </section>

        <Secao icone={Tag} titulo="A página"
               resumo="O endereço é o único campo que não dá para mudar depois sem quebrar o link já divulgado.">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Handle</label>
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-sm text-muted-foreground">bekrew.com/@</span>
                <input
                  name="slug" required value={slug}
                  onBlur={(e) => conferirSlug(e.target.value)}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))
                    setSlugStatus(null)
                  }}
                  placeholder="nomedocriador"
                  className={`${campo} font-mono text-xs`}
                />
              </div>
              {slugStatus && (
                <p className={`text-xs ${slugStatus.livre ? 'text-ok' : 'text-destructive'}`}>
                  {slugStatus.livre ? 'disponível' : slugStatus.porque}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Nome</label>
              <input name="nome" required value={nome} onChange={(e) => setNome(e.target.value)}
                     placeholder="Como o nome aparece na página" className={campo} />
            </div>
          </div>
        </Secao>

        {erro && (
          <p className="rounded-lg border border-destructive/40 bg-perigo-fundo px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}

        <BotaoSalvar
          tipo="submit" rotulo="Criar página e editar" pendente={pendente}
          desabilitado={slugStatus?.livre === false || !slug.trim() || !nome.trim()}
        />
      </form>
    </div>
  )
}
