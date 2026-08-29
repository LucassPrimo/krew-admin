'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
  Activity, BadgeCheck, Blocks, Contact, CreditCard, Database, FileWarning, Gauge,
  LayoutDashboard, LogOut, Mail, PanelLeftClose, PanelLeftOpen, ScrollText,
  Search, Send, ShieldCheck, Terminal, TrendingUp, UserRound, Users, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { KrewLogo } from '@/components/ui/krew-logo'
import { SidebarNav, type GrupoNav, type ItemNav } from '@/components/ui/dashboard-sidebar'
import { supabaseBrowser } from '@/lib/supabase-browser'

/**
 * A casca do painel: barra lateral, topo e paleta de comandos.
 *
 * É Client Component porque guarda estado de interface (barra aberta, paleta
 * aberta) — mas nenhum dado do produto passa por aqui. Quem lê o banco continua
 * sendo cada página, no servidor, pela conexão RO. A casca recebe só o que já
 * foi decidido lá: o e-mail de quem entrou e os dois contadores dos badges.
 */

export type Contadores = {
  ofertasAbertas: number
  emailsComFalha: number
  /** Leads com follow-up vencido — a fila de hoje no CRM. */
  crmParaHoje: number
}

function montarGrupos(c: Contadores): GrupoNav[] {
  return [
    {
      itens: [
        { titulo: 'Buscar', icone: Search, atalho: '⌘K', acao: 'buscar' },
        { href: '/', titulo: 'Visão geral', icone: LayoutDashboard },
      ],
    },
    {
      titulo: 'Operação',
      itens: [
        { href: '/crm', titulo: 'CRM', icone: Contact, badge: c.crmParaHoje },
        { href: '/ofertas', titulo: 'Ofertas de bio', icone: Send, badge: c.ofertasAbertas },
        { href: '/pessoas', titulo: 'Pessoas', icone: Users },
        { href: '/emails', titulo: 'E-mails', icone: Mail, badge: c.emailsComFalha },
      ],
    },
    {
      titulo: 'Análise',
      itens: [
        {
          titulo: 'Relatórios',
          icone: TrendingUp,
          filhos: [
            { href: '/analise/assinaturas', titulo: 'Assinaturas', icone: CreditCard },
            { href: '/analise/aquisicao', titulo: 'Aquisição', icone: Activity },
            { href: '/analise/uso', titulo: 'Uso do produto', icone: Gauge },
            { href: '/analise/retencao', titulo: 'Retenção', icone: UserRound },
          ],
        },
      ],
    },
    {
      titulo: 'Plataforma',
      itens: [
        {
          titulo: 'Dados',
          icone: Database,
          filhos: [
            { href: '/dados', titulo: 'Todas as tabelas', icone: Blocks },
            { href: '/dados/profiles', titulo: 'Perfis', icone: UserRound },
            { href: '/dados/subscriptions', titulo: 'Assinaturas', icone: CreditCard },
            { href: '/dados/proposal_pages', titulo: 'Páginas / bio', icone: BadgeCheck },
          ],
        },
        { href: '/integridade', titulo: 'Integridade', icone: ShieldCheck },
        { href: '/sql', titulo: 'Console SQL', icone: Terminal },
        { href: '/auditoria', titulo: 'Auditoria', icone: ScrollText },
      ],
    },
  ]
}

const RODAPE: ItemNav[] = [{ titulo: 'Sair', icone: LogOut, acao: 'sair' }]

/** Tudo que a paleta de comandos alcança, achatado. */
const DESTINOS: { href: string; titulo: string; icone: typeof Search; contexto: string }[] = [
  { href: '/', titulo: 'Visão geral', icone: LayoutDashboard, contexto: '' },
  { href: '/crm', titulo: 'CRM de prospecção', icone: Contact, contexto: 'Operação' },
  { href: '/ofertas', titulo: 'Ofertas de bio', icone: Send, contexto: 'Operação' },
  { href: '/ofertas/nova', titulo: 'Nova oferta de bio', icone: Send, contexto: 'Operação' },
  { href: '/pessoas', titulo: 'Pessoas', icone: Users, contexto: 'Operação' },
  { href: '/emails', titulo: 'E-mails', icone: Mail, contexto: 'Operação' },
  { href: '/analise/assinaturas', titulo: 'Assinaturas', icone: CreditCard, contexto: 'Análise' },
  { href: '/analise/aquisicao', titulo: 'Aquisição', icone: Activity, contexto: 'Análise' },
  { href: '/analise/uso', titulo: 'Uso do produto', icone: Gauge, contexto: 'Análise' },
  { href: '/analise/retencao', titulo: 'Retenção', icone: UserRound, contexto: 'Análise' },
  { href: '/dados', titulo: 'Dados', icone: Database, contexto: 'Plataforma' },
  { href: '/integridade', titulo: 'Integridade', icone: ShieldCheck, contexto: 'Plataforma' },
  { href: '/sql', titulo: 'Console SQL', icone: Terminal, contexto: 'Plataforma' },
  { href: '/auditoria', titulo: 'Auditoria', icone: ScrollText, contexto: 'Plataforma' },
]

const TITULOS: Record<string, string> = Object.fromEntries(
  DESTINOS.map((d) => [d.href, d.titulo]),
)

export function Shell({
  email, escritaLigada, contadores, children,
}: {
  email: string
  escritaLigada: boolean
  contadores: Contadores
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [aberta, setAberta] = useState(true)
  const [paleta, setPaleta] = useState(false)
  const [busca, setBusca] = useState('')

  const grupos = useMemo(() => montarGrupos(contadores), [contadores])

  // ⌘K abre, Esc fecha. `preventDefault` porque ⌘K é atalho de barra de
  // endereço em alguns navegadores — sem ele, o foco sairia da página.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaleta((v) => !v)
      }
      if (e.key === 'Escape') setPaleta(false)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  // Fecha a paleta quando a rota muda: sem isto ela ficaria sobreposta à tela
  // recém-aberta, escondendo justamente o que a pessoa foi buscar.
  useEffect(() => setPaleta(false), [pathname])

  async function agir(acao: 'buscar' | 'sair') {
    if (acao === 'buscar') {
      setPaleta(true)
      return
    }
    await supabaseBrowser().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const termo = busca.trim().toLowerCase()
  const achados = termo
    ? DESTINOS.filter((d) => d.titulo.toLowerCase().includes(termo))
    : DESTINOS

  // Trilha do topo: o segmento mais específico que a navegação conhece.
  const titulo =
    TITULOS[pathname] ??
    DESTINOS.filter((d) => d.href !== '/' && pathname.startsWith(d.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.titulo ??
    'Painel'

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <div
        className={`h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          aberta ? 'w-[260px] opacity-100' : 'w-0 opacity-0'
        }`}
      >
        <SidebarNav
          grupos={grupos}
          rodape={RODAPE}
          escritaLigada={escritaLigada}
          email={email}
          aoAgir={agir}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border/50 flex items-center px-4 justify-between bg-card shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setAberta(!aberta)}
              aria-label={aberta ? 'Recolher menu' : 'Abrir menu'}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors"
            >
              {aberta
                ? <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.5} />
                : <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />}
            </button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
              <KrewLogo className="h-3.5 w-auto shrink-0 text-muted-foreground" />
              <span>/</span>
              <span className="font-medium text-foreground truncate">{titulo}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!escritaLigada && (
              <span className="hidden md:inline-flex items-center h-6 px-2 rounded-md border border-primary/40 bg-primary/5 text-[11px] text-primary">
                modo leitura
              </span>
            )}
            <button
              onClick={() => setPaleta(true)}
              className="hidden md:flex items-center gap-2 h-8 w-56 px-2.5 rounded-md bg-black/5 dark:bg-white/5 text-[13px] text-muted-foreground/70 hover:text-foreground transition-colors"
            >
              <Search className="w-4 h-4" strokeWidth={1.5} />
              <span className="flex-1 text-left">Buscar…</span>
              <kbd className="font-mono text-[10px]">⌘K</kbd>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>

      {paleta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/40 backdrop-blur-sm px-4">
          <div className="absolute inset-0" onClick={() => setPaleta(false)} />
          <div className="relative w-full max-w-xl bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-in">
            <div className="flex items-center px-4 border-b border-border/50">
              <Search className="w-[18px] h-[18px] text-muted-foreground/70 mr-3 shrink-0" strokeWidth={1.5} />
              <input
                autoFocus value={busca} onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  // Enter vai no primeiro resultado: quem digitou "audit" e
                  // apertou Enter quis abrir a auditoria, não escolher de novo.
                  if (e.key === 'Enter' && achados[0]) router.push(achados[0].href)
                }}
                className="flex-1 bg-transparent py-4 outline-none text-[14px] text-foreground placeholder:text-muted-foreground/50"
                placeholder="Ir para uma tela…"
              />
              <button
                onClick={() => setPaleta(false)}
                className="ml-3 p-1 rounded-md text-muted-foreground/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground transition-colors"
                aria-label="Fechar"
              >
                <X className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-1.5">
              {achados.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center">
                  <FileWarning className="w-6 h-6 text-muted-foreground/30 mb-2" strokeWidth={1.5} />
                  <p className="text-[13px] text-muted-foreground">Nenhuma tela com esse nome.</p>
                </div>
              ) : (
                achados.map((d) => (
                  <button
                    key={d.href}
                    onClick={() => router.push(d.href)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-[13px] text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors"
                  >
                    <d.icone className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <span className="flex-1 truncate">{d.titulo}</span>
                    {d.contexto && (
                      <span className="text-[11px] text-muted-foreground/50">{d.contexto}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
