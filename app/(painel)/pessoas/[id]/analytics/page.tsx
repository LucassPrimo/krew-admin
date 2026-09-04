import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Barras } from '@/components/graficos'
import { Card, Metrica, Vazio } from '@/components/ui'
import { dbRO } from '@/lib/db'
import { dataHora, numero, relativo } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * O Analytics da bio de UMA pessoa — o mesmo painel que o criador vê em
 * /analytics no krew-app, do lado de cá.
 *
 * Duas diferenças que valem entender, e as duas vêm de onde a página mora:
 *
 * 1. Lê por `dbRO` (BYPASSRLS), não pelos RPCs `get_bio_*`. Aqueles resolvem
 *    org e assinatura para decidir o que o dono pode ver; aqui não há dono nem
 *    plano — o suporte precisa enxergar o Free igual ao PRO, e um segundo
 *    caminho que aplicasse o gate mostraria zero para metade da base.
 * 2. Não há k-anonimato no recorte por cidade. O piso do produto existe para o
 *    criador não identificar um visitante pela cidade dele; aqui a tela é
 *    interna, e esconder linha é justamente o que impede responder "de onde
 *    veio esse pico de ontem".
 *
 * `link_bio_events` guarda cidade/região resolvida e um id anônimo de cookie —
 * não IP, não PII. Por isso esta página não passa por `mascarar()` nem grava
 * em `admin_audit`: não há campo sensível a revelar.
 */

const PERIODOS = [7, 30, 90] as const

export default async function AnalyticsDaPessoa({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ dias?: string }>
}) {
  const { id } = await params
  const { dias: diasBruto } = await searchParams

  // Só os três valores do seletor: `dias` vem da URL, e um número solto ali
  // vira `interval` na consulta — 100000 dias de generate_series desenharia
  // cem mil linhas no gráfico.
  const dias = PERIODOS.includes(Number(diasBruto) as (typeof PERIODOS)[number])
    ? Number(diasBruto)
    : 30

  const [perfil] = await dbRO<{ nome: string | null; sobrenome: string | null }[]>`
    select full_name as nome, sobrenome from public.profiles where id = ${id}
  `
  if (!perfil) notFound()

  const [pagina, resumo, porDia, porBotao, porDispositivo, porOrigem, porLugar] = await Promise.all([
    dbRO<{ slug: string; bio_ativo: boolean }[]>`
      select slug, bio_ativo from public.proposal_pages where user_id = ${id}`,
    dbRO<{ views: number; cliques: number; visitantes: number; ultimo: string | null }[]>`
      select
        count(*) filter (where event_type = 'page_view')::int as views,
        count(*) filter (where event_type = 'button_click')::int as cliques,
        count(distinct visitor_id)::int as visitantes,
        max(created_at) as ultimo
      from public.link_bio_events
      where user_id = ${id} and created_at >= current_date - ${dias}::int`,
    // generate_series pelo mesmo motivo de `cadastrosPorDia`: sem ele, o dia
    // sem evento sumiria do eixo e o gráfico mentiria sobre o ritmo.
    dbRO<{ dia: string; views: number; cliques: number }[]>`
      select to_char(d.dia, 'DD/MM') as dia,
             count(e.id) filter (where e.event_type = 'page_view')::int as views,
             count(e.id) filter (where e.event_type = 'button_click')::int as cliques
      from generate_series(current_date - ${dias}::int, current_date, '1 day') d(dia)
      left join public.link_bio_events e
        on date(e.created_at) = d.dia and e.user_id = ${id}
      group by d.dia order by d.dia`,
    // O título vem de `creator_links`, mas o LEFT JOIN é obrigatório: o
    // `button_id` é `on delete set null`, então clique de link apagado
    // continua no histórico sem linha do outro lado.
    dbRO<{ tipo: string | null; rotulo: string | null; cliques: number }[]>`
      select e.button_kind as tipo,
             coalesce(l.titulo, e.button_ref) as rotulo,
             count(*)::int as cliques
      from public.link_bio_events e
      left join public.creator_links l on l.id = e.button_id
      where e.user_id = ${id} and e.event_type = 'button_click'
        and e.created_at >= current_date - ${dias}::int
      group by e.button_kind, coalesce(l.titulo, e.button_ref)
      order by cliques desc limit 20`,
    dbRO<{ aparelho: string; eventos: number }[]>`
      select coalesce(device_type, 'desconhecido') as aparelho, count(*)::int as eventos
      from public.link_bio_events
      where user_id = ${id} and created_at >= current_date - ${dias}::int
      group by 1 order by eventos desc`,
    dbRO<{ origem: string; eventos: number }[]>`
      select coalesce(nullif(referrer, ''), 'direto') as origem, count(*)::int as eventos
      from public.link_bio_events
      where user_id = ${id} and created_at >= current_date - ${dias}::int
      group by 1 order by eventos desc limit 12`,
    dbRO<{ cidade: string | null; regiao: string | null; pais: string | null
           visitantes: number; eventos: number }[]>`
      select city as cidade, region as regiao, country as pais,
             count(distinct visitor_id)::int as visitantes, count(*)::int as eventos
      from public.link_bio_events
      where user_id = ${id} and created_at >= current_date - ${dias}::int
      group by city, region, country order by eventos desc limit 15`,
  ])

  const r = resumo[0]
  const bio = pagina[0]
  const ctr = r.views > 0 ? (r.cliques / r.views) * 100 : 0
  const nome = [perfil.nome, perfil.sobrenome].filter(Boolean).join(' ') || '(sem nome)'

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-medium">Analytics · {nome}</h1>
          <p className="font-mono text-xs text-texto-fraco">
            {bio ? `@${bio.slug}${bio.bio_ativo ? '' : ' · página desligada'}` : 'sem página de bio'}
          </p>
        </div>
        <Link href={`/pessoas/${id}`} className="text-sm text-texto-fraco hover:text-texto">voltar</Link>
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {PERIODOS.map((p) => (
          <Link
            key={p}
            href={`/pessoas/${id}/analytics?dias=${p}`}
            className={`rounded-md border px-2 py-1 ${
              p === dias ? 'border-acento text-acento' : 'border-borda text-texto-fraco hover:text-texto'
            }`}
          >
            {p} dias
          </Link>
        ))}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica rotulo="Visitas" valor={numero(r.views)} />
        <Metrica rotulo="Cliques" valor={numero(r.cliques)} />
        <Metrica rotulo="Visitantes únicos" valor={numero(r.visitantes)} />
        <Metrica
          rotulo="Cliques por visita"
          valor={`${ctr.toFixed(1)}%`}
          nota={r.ultimo ? `último evento ${relativo(r.ultimo)}` : 'sem evento no período'}
        />
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium">Visitas por dia</h2>
          <Barras dados={porDia.map((d) => ({ rotulo: d.dia, valor: d.views }))} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-medium">Cliques por dia</h2>
          <Barras dados={porDia.map((d) => ({ rotulo: d.dia, valor: d.cliques }))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-sm font-medium">No que clicaram</h2>
          <p className="mb-3 text-xs text-texto-fraco">
            Link apagado continua aqui, sem título: o evento sobrevive ao link.
          </p>
          {porBotao.length === 0 ? <Vazio>Nenhum clique no período.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Alvo</th><th>Tipo</th><th>Cliques</th></tr></thead>
              <tbody>
                {porBotao.map((b, i) => (
                  <tr key={`${b.tipo}-${b.rotulo}-${i}`}>
                    <td>{b.rotulo ?? '(link apagado)'}</td>
                    <td className="text-texto-fraco">{b.tipo ?? '—'}</td>
                    <td className="tabular-nums">{numero(b.cliques)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">De onde vieram</h2>
          {porOrigem.length === 0 ? <Vazio>Sem acessos no período.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Origem</th><th>Eventos</th></tr></thead>
              <tbody>
                {porOrigem.map((o) => (
                  <tr key={o.origem}>
                    <td className="max-w-[24rem] truncate" title={o.origem}>{o.origem}</td>
                    <td className="tabular-nums">{numero(o.eventos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Aparelho</h2>
          {porDispositivo.length === 0 ? <Vazio>Sem acessos no período.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Tipo</th><th>Eventos</th></tr></thead>
              <tbody>
                {porDispositivo.map((d) => (
                  <tr key={d.aparelho}>
                    <td>{d.aparelho}</td>
                    <td className="tabular-nums">{numero(d.eventos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-medium">Onde estão</h2>
          <p className="mb-3 text-xs text-texto-fraco">
            Cidade aproximada por geo-IP. Linha sem cidade é acesso que a
            resolução não completou — não é acesso sem localização.
          </p>
          {porLugar.length === 0 ? <Vazio>Sem acessos no período.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Lugar</th><th>Visitantes</th><th>Eventos</th></tr></thead>
              <tbody>
                {porLugar.map((l, i) => (
                  <tr key={`${l.cidade}-${l.regiao}-${l.pais}-${i}`}>
                    <td>
                      {[l.cidade, l.regiao, l.pais].filter(Boolean).join(' / ') || '(não resolvido)'}
                    </td>
                    <td className="tabular-nums">{numero(l.visitantes)}</td>
                    <td className="tabular-nums">{numero(l.eventos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {r.ultimo && (
        <p className="mt-4 text-xs text-texto-fraco">
          Último evento registrado em {dataHora(r.ultimo)}.
        </p>
      )}
    </>
  )
}
