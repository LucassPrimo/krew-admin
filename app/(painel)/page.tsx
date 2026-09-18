import Link from 'next/link'

import { Badge, Card, Metrica, Titulo, Vazio } from '@/components/ui'
import { listarLeads, vencido } from '@/lib/crm'
import { data, dinheiro, numero, relativo } from '@/lib/format'
import { ativacao, contasEmRisco, pendenciasOperacionais, topo } from '@/lib/metricas'

export const dynamic = 'force-dynamic'

/**
 * Visão geral: as perguntas que se faz ao abrir o painel de manhã.
 *
 * A ordem das métricas é a ordem da atenção, não a do banco: primeiro o que
 * exige ação hoje (ofertas paradas, dinheiro vencido), depois o que mede o
 * negócio. Um dashboard ordenado por "o que era fácil de calcular" é o que faz
 * ninguém olhar depois da segunda semana.
 */
export default async function VisaoGeral() {
  const [t, marcos, risco, pendencias, leads] = await Promise.all([
    topo(), ativacao(), contasEmRisco(), pendenciasOperacionais(), listarLeads(),
  ])
  const hoje = leads.filter(vencido)
  const fila = [
    { titulo: 'Follow-ups vencidos', n: hoje.length, href: '/crm?hoje=1', tom: 'perigo' as const, acao: 'Falar hoje' },
    { titulo: 'Ofertas sem convite', n: pendencias.ofertas_sem_convite, href: '/ofertas?fila=sem_convite', tom: 'aviso' as const, acao: 'Revisar e enviar' },
    { titulo: 'Convites sem resposta', n: pendencias.convites_sem_resposta, href: '/ofertas?fila=sem_resposta', tom: 'aviso' as const, acao: 'Fazer follow-up' },
    { titulo: 'Trials terminando', n: pendencias.trials_terminando, href: '/analise/assinaturas?filtro=trial', tom: 'aviso' as const, acao: 'Ver users' },
    { titulo: 'Pagamentos atrasados', n: pendencias.pagamentos_atrasados, href: '/analise/assinaturas?filtro=atrasado', tom: 'perigo' as const, acao: 'Resolver' },
    { titulo: 'Falhas de e-mail', n: pendencias.emails_com_falha, href: '/emails?status=failed', tom: 'perigo' as const, acao: 'Investigar' },
  ].filter((p) => p.n > 0)

  return (
    <>
      <Titulo>Visão geral</Titulo>

      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div><h2 className="text-sm font-medium">O que precisa de atenção</h2><p className="text-xs text-texto-fraco">A fila operacional de hoje, em ordem de ação.</p></div>
          <div className="flex gap-2"><Link href="/crm" className="rounded-md border border-borda px-2.5 py-1.5 text-xs hover:border-borda-forte">Abrir CRM</Link><Link href="/users" className="rounded-md bg-acento px-2.5 py-1.5 text-xs font-medium text-fundo">Buscar user</Link></div>
        </div>
        {fila.length === 0 ? <p className="py-4 text-sm text-ok">Nenhuma pendência crítica agora.</p> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{fila.map((item) => (
            <Link key={item.titulo} href={item.href} className="flex items-center justify-between rounded-md border border-borda p-3 transition-colors hover:border-borda-forte hover:bg-painel-2">
              <div><div className="text-sm font-medium">{item.titulo}</div><div className="mt-1 text-xs text-texto-fraco">{item.acao}</div></div>
              <Badge tom={item.tom}>{numero(item.n)}</Badge>
            </Link>
          ))}</div>
        )}
      </Card>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica rotulo="Ofertas de bio abertas" valor={numero(t.ofertas_abertas)} nota="ainda não aceitas" />
        <Metrica
          rotulo="A receber vencido" valor={dinheiro(t.a_receber_vencido)}
          nota="dos clientes" alerta={Number(t.a_receber_vencido ?? 0) > 0}
        />
        <Metrica rotulo="Assinantes pagos" valor={numero(t.assinantes_pagos)} />
        <Metrica rotulo="Em teste" valor={numero(t.trials_ativos)} nota="trial ativo" />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica rotulo="Cadastros (7d)" valor={numero(t.cadastros_7d)} nota={`${numero(t.cadastros_30d)} em 30d`} />
        <Metrica
          rotulo="Onboarding completo" valor={numero(t.onboarding_completo)}
          nota={`de ${numero(t.contas_total)} contas`}
        />
        <Metrica rotulo="Bios no ar" valor={numero(t.bios_ativas)} />
        <Metrica rotulo="Propostas (7d)" valor={numero(t.propostas_7d)} />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica rotulo="Campanhas abertas" valor={numero(t.campanhas_abertas)} />
        <Metrica rotulo="GMV do mês" valor={dinheiro(t.gmv_mes)} nota="faturamento dos criadores" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium">Ativação</h2>
          <p className="mb-3 text-xs text-texto-fraco">
            Quantas contas chegaram a cada marco. A maior queda entre dois
            marcos é onde o produto perde gente.
          </p>
          <table className="densa">
            <tbody>
              {marcos.map((m) => (
                <tr key={m.marco}>
                  <td>{m.marco}</td>
                  <td className="text-right tabular-nums">{numero(m.contas)}</td>
                  <td className="w-32">
                    <div className="h-1.5 rounded-full bg-painel-2">
                      <div
                        className="h-1.5 rounded-full bg-acento"
                        style={{
                          width: `${t.contas_total > 0 ? Math.min((m.contas / t.contas_total) * 100, 100) : 0}%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Contas mais paradas</h2>
          <p className="mb-3 text-xs text-texto-fraco">
            Ordenado pela última coisa que a pessoa FEZ (campanha, marca, link,
            proposta). Login não conta — abrir o app e não fazer nada é
            justamente o padrão de quem está saindo.
          </p>
          {risco.length === 0 ? (
            <Vazio>Nenhuma conta ainda.</Vazio>
          ) : (
            <table className="densa">
              <thead>
                <tr><th>Conta</th><th>Cadastro</th><th>Última atividade</th></tr>
              </thead>
              <tbody>
                {risco.slice(0, 12).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a href={`/users/${c.id}`} className="text-acento hover:underline">
                        {c.nome ?? '(sem nome)'}
                      </a>
                    </td>
                    <td className="text-texto-fraco">{data(c.criado_em)}</td>
                    <td className={c.dias_parado !== null && c.dias_parado > 30 ? 'text-perigo' : ''}>
                      {c.ultima_atividade ? relativo(c.ultima_atividade) : 'nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  )
}
