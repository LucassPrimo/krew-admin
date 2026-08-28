import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import {
  AtSign, Handshake, Image as ImageIcon, Link2, Palette, Power, Send, Sparkles, Users,
} from 'lucide-react'

import { getConfigBio, getLinksBio } from '@/app/actions/bio'
import { getCliquesPorLink } from '@/app/actions/bio-analytics'
import { BioPerfilCard } from '@/components/bio/bio-perfil-card'
import { BioRedesCard } from '@/components/bio/bio-redes-card'
import { BioLinksCard } from '@/components/bio/bio-links-card'
import { BioCorFundo } from '@/components/bio/bio-cor-fundo'
import { SecaoBio } from '@/components/bio/secao-bio'
import { ToggleBio } from '@/components/bio/toggle-bio'
import { BlocoOferta } from '@/components/oferta/bloco-oferta'
import { PreviewPublica } from '@/components/preview/preview-publica'
import { alvoDaOferta } from '@/lib/alvo'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * O editor da oferta — a MESMA tela `/profile` do krew-app.
 *
 * Os componentes vieram copiados, sem alteração: `SecaoBio`, `BioPerfilCard`,
 * `BioRedesCard`, `BioLinksCard`, `BioCorFundo`, `ToggleBio` e
 * `PreviewPublica` são os arquivos do produto. As actions que eles chamam
 * (`app/actions/bio.ts`) também. Isso é deliberado: as duas telas editam a
 * MESMA tabela, e código copiado que volta igual é código que não diverge.
 *
 * O que foi adaptado, e só isto:
 *
 * 1. **De quem é a bio.** No app a resposta é "de quem está logado". Aqui é o
 *    dono da oferta — resolvido em `lib/alvo.ts` e entregue às actions pelo
 *    `lib/supabase/server.ts` do painel, que devolve o cliente de serviço com
 *    `auth.getUser()` respondendo o criador. Nenhuma action precisou mudar.
 * 2. **A prévia** aponta para a página pública (`bekrew.com/@slug`) em vez de
 *    `/previa-bio`, que é rota do app e exige sessão de lá.
 * 3. **Os recursos PRO ficam liberados.** A conta da oferta não tem assinatura
 *    (o trial só começa quando a pessoa aceita), e travar os campos aqui
 *    impediria de montar a oferta que existe justamente para vender o plano.
 */
export default async function EditorDaOferta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('bioConfig')

  const alvo = await alvoDaOferta(id)
  if (!alvo) notFound()

  const supabase = await createClient()

  const [config, links, cliques, perfilRes, redesRes, ofertaRes] = await Promise.all([
    getConfigBio(),
    getLinksBio(),
    getCliquesPorLink(alvo.userId),
    supabase.from('profiles').select('full_name, avatar_url').eq('id', alvo.userId).maybeSingle(),
    supabase
      .from('creator_social_networks')
      .select('platform, handle, url, ordem, ativo')
      .eq('user_id', alvo.userId)
      .order('ordem')
      .order('created_at'),
    supabase
      .from('bio_ofertas')
      .select('aceita_em, email_convite, convite_enviado_em, notas, token')
      .eq('page_id', id)
      .maybeSingle(),
  ])

  const oferta = ofertaRes.data as
    | {
        aceita_em: string | null; email_convite: string | null
        convite_enviado_em: string | null; notas: string | null; token: string
      }
    | null

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* O endereço que MOSTRA depende do estado da oferta, e não é
            cosmético: enquanto ela não é aceita, o `/@handle` devolve 404 de
            propósito (a página nasce `bio_ativo = false`), e a única porta é o
            link secreto. Oferecer o handle aqui seria mandar você divulgar um
            endereço quebrado. */}
        <div className="flex items-center gap-2">
          <a
            href={
              oferta?.aceita_em
                ? `https://bekrew.com/@${alvo.slug}`
                : `https://bekrew.com/oferta/${oferta?.token ?? ''}`
            }
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground hover:text-primary"
          >
            {oferta?.aceita_em ? `bekrew.com/@${alvo.slug}` : 'abrir a prévia'}
          </a>
          {oferta?.aceita_em ? (
            <span className="text-xs text-muted-foreground">oferta já aceita</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              fora do ar e fora da busca — só quem tem o link vê
            </span>
          )}
        </div>
        <Link href="/ofertas" className="text-sm text-muted-foreground hover:text-foreground">
          voltar
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,36rem)_320px] lg:items-start">
        <div className="flex flex-col gap-3">
          <SecaoBio
            icone={Power}
            titulo={t('paginaAtiva')}
            resumo={t('paginaAtivaDesc')}
            acao={
              <ToggleBio
                campo="bio_ativo"
                inicial={config?.bio_ativo ?? true}
                rotulo={t('paginaAtiva')}
              />
            }
          />

          <SecaoBio icone={Palette} titulo={t('secaoCor')} resumo={t('secaoCorDesc')}>
            <BioCorFundo inicial={config?.bio_bg_color ?? null} />
          </SecaoBio>

          <SecaoBio indice={1} icone={ImageIcon} titulo={t('secaoCapa')} resumo={t('secaoCapaDesc')}>
            <BioPerfilCard
              userId={alvo.userId}
              avatarUrl={perfilRes.data?.avatar_url ?? null}
              capaUrl={config?.bio_capa_url ?? null}
              nome={perfilRes.data?.full_name ?? null}
              headline={config?.bio_headline ?? null}
              texto={config?.bio_texto ?? null}
            />
          </SecaoBio>

          <SecaoBio indice={2} icone={AtSign} titulo={t('secaoRedes')} resumo={t('secaoRedesDesc')}>
            <BioRedesCard redesIniciais={redesRes.data ?? []} />
          </SecaoBio>

          <SecaoBio
            indice={3}
            icone={Users}
            titulo={t('secaoSeguidores')}
            resumo={t('mostrarSeguidoresDesc')}
            acao={
              <ToggleBio
                campo="bio_mostrar_seguidores"
                inicial={config?.bio_mostrar_seguidores ?? false}
                pro
                temPro
                rotulo={t('mostrarSeguidores')}
              />
            }
          />

          <SecaoBio
            indice={4}
            icone={Send}
            titulo={t('secaoPropostas')}
            resumo={t('mostrarPropostasDesc')}
            acao={
              <ToggleBio
                campo="bio_mostrar_propostas"
                inicial={config?.bio_mostrar_propostas ?? true}
                pro
                temPro
                rotulo={t('mostrarPropostas')}
              />
            }
          />

          <SecaoBio indice={5} icone={Link2} titulo={t('secaoLinks')} resumo={t('secaoLinksDesc')}>
            <BioLinksCard userId={alvo.userId} linksIniciais={links} cliques={cliques} pro />
          </SecaoBio>

          <SecaoBio
            indice={6}
            icone={Sparkles}
            titulo={t('secaoRodape')}
            resumo={t('esconderMarcaDesc')}
            acao={
              <ToggleBio
                campo="bio_esconder_marca"
                inicial={config?.bio_esconder_marca ?? false}
                pro
                temPro
                rotulo={t('esconderMarca')}
              />
            }
          />
          <SecaoBio
            icone={Handshake}
            titulo="A oferta"
            resumo={oferta?.aceita_em
              ? 'Já aceita — a conta é do criador.'
              : 'Convite, aceite e as suas anotações de venda.'}
          >
            <BlocoOferta
              pageId={id}
              slug={alvo.slug}
              linkPrevia={
                oferta?.token ? `https://bekrew.com/oferta/${oferta.token}` : null
              }
              emailInicial={oferta?.email_convite ?? null}
              conviteEnviadoEm={oferta?.convite_enviado_em ?? null}
              aceitaEm={oferta?.aceita_em ?? null}
              notasIniciais={oferta?.notas ?? null}
            />
          </SecaoBio>
        </div>

        <PreviewPublica
          versao={String(Date.now())}
          abas={[
            oferta?.aceita_em
              ? { chave: 'bio', label: `/@${alvo.slug}`, url: `https://bekrew.com/@${alvo.slug}` }
              : {
                  chave: 'bio',
                  label: 'prévia',
                  url: `https://bekrew.com/oferta/${oferta?.token ?? ''}`,
                },
          ]}
        />
      </div>
    </div>
  )
}
