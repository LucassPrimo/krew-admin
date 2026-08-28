'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { KrewLogo } from './krew-logo'

/**
 * A navegação do painel.
 *
 * Adaptada do componente de referência com uma mudança estrutural: os itens são
 * ROTAS, não ids num `useState`. O original guardava a seleção em memória, o
 * que numa demo é suficiente e num app real significaria perder o destaque a
 * cada recarga, quebrar o botão "voltar" e não permitir mandar link de tela
 * para ninguém. Aqui `usePathname` é a fonte da verdade e cada item é um
 * `<Link>` — o navegador continua sendo o navegador.
 */

export type ItemNav = {
  href?: string
  titulo: string
  icone: LucideIcon
  badge?: number | string
  atalho?: string
  /** Item com filhos vira acordeão e não navega sozinho. */
  filhos?: ItemNav[]
  /** Ação em vez de rota (buscar, sair). */
  acao?: 'buscar' | 'sair'
}

export type GrupoNav = { titulo?: string; itens: ItemNav[] }

function estaAtivo(pathname: string, item: ItemNav): boolean {
  if (!item.href) return false
  // `/` só casa exato: sem isso a Visão geral ficaria acesa em toda tela,
  // porque toda rota começa com barra.
  return item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
}

function temFilhoAtivo(pathname: string, item: ItemNav): boolean {
  return Boolean(item.filhos?.some((f) => estaAtivo(pathname, f)))
}

function Item({
  item, nivel = 0, aoAgir,
}: { item: ItemNav; nivel?: number; aoAgir?: (acao: 'buscar' | 'sair') => void }) {
  const pathname = usePathname()
  const ativo = estaAtivo(pathname, item)
  const temFilhos = Boolean(item.filhos?.length)

  // Um grupo cujo filho está na tela nasce aberto: fechar o ramo em que a
  // pessoa está esconderia justamente onde ela se encontra.
  const [aberto, setAberto] = useState(() => temFilhoAtivo(pathname, item))

  const classes = `group flex items-center justify-between px-2.5 py-[7px] rounded-[6px] cursor-pointer transition-all duration-200 select-none ${
    ativo
      ? 'bg-black/5 dark:bg-white/10 text-foreground font-medium'
      : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground/90'
  }`

  const conteudo = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        <item.icone
          className={`w-[16px] h-[16px] shrink-0 transition-colors ${
            ativo ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-foreground/70'
          }`}
          strokeWidth={1.5}
        />
        <span className="text-[13px] tracking-wide truncate">{item.titulo}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {item.atalho && (
          <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium font-mono text-muted-foreground/60 bg-background/50 border border-border/50 rounded-[4px]">
            {item.atalho}
          </kbd>
        )}
        {item.badge !== undefined && item.badge !== 0 && (
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
            {item.badge}
          </span>
        )}
        {temFilhos && (
          <ChevronRight
            className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200 ${aberto ? 'rotate-90' : ''}`}
            strokeWidth={2}
          />
        )}
      </div>
    </>
  )

  const estilo = { paddingLeft: `${nivel * 12 + 10}px` }

  return (
    <div className="flex flex-col w-full">
      {temFilhos ? (
        <div className={classes} style={estilo} onClick={() => setAberto(!aberto)}>
          {conteudo}
        </div>
      ) : item.acao ? (
        <button type="button" className={`${classes} w-full`} style={estilo} onClick={() => aoAgir?.(item.acao!)}>
          {conteudo}
        </button>
      ) : (
        <Link href={item.href ?? '#'} className={classes} style={estilo}>
          {conteudo}
        </Link>
      )}

      {temFilhos && (
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            aberto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0 relative flex flex-col gap-0.5 mt-0.5">
            <div
              className="absolute top-0 bottom-0 border-l border-black/5 dark:border-white/5"
              style={{ left: `${nivel * 12 + 17.5}px` }}
            />
            {item.filhos!.map((filho) => (
              <Item key={filho.titulo} item={filho} nivel={nivel + 1} aoAgir={aoAgir} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * O cabeçalho da barra. No original era um seletor de workspace.
 *
 * Aqui não existe workspace — existe UM painel, com dono único (foi a decisão
 * na hora de montar). Manter um seletor que não seleciona nada seria enfeite
 * prometendo função inexistente. O bloco ficou com o mesmo peso visual e passou
 * a carregar a marca e o estado que importa saber ao olhar para esta tela.
 *
 * O rótulo "interno" ao lado do wordmark não é decoração. Ele nasceu quando o
 * painel usava o mint do produto e a cor deixou de distinguir os dois; com a
 * paleta agora em preto e cinza a distinção voltou a ser visível, mas a
 * palavra fica — é ela que continua funcionando numa captura de tela, num
 * monitor mal calibrado ou para quem não vê cor.
 */
function Identidade({ escritaLigada }: { escritaLigada: boolean }) {
  return (
    <div className="flex items-center gap-3 px-2 py-2 mb-4 rounded-lg select-none">
      {/* O ícone quadrado é monocromático no próprio SVG — ladrilho chumbo,
          glifo branco. Ver o comentário da paleta em `globals.css`. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/krew-icon.svg" alt="" width={32} height={32} className="rounded-[6px] shrink-0" />

      <div className="flex flex-col gap-1 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <KrewLogo className="h-[13px] w-auto text-foreground" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            interno
          </span>
        </div>
        <span className={`text-[11px] leading-none ${escritaLigada ? 'text-primary' : 'text-muted-foreground'}`}>
          {escritaLigada ? 'escrita ligada' : 'modo leitura'}
        </span>
      </div>
    </div>
  )
}

export function SidebarNav({
  grupos, rodape, escritaLigada, email, className = '', aoAgir,
}: {
  grupos: GrupoNav[]
  rodape: ItemNav[]
  escritaLigada: boolean
  email: string
  className?: string
  aoAgir?: (acao: 'buscar' | 'sair') => void
}) {
  return (
    <div className={`flex flex-col w-[260px] h-full bg-card/50 border-r border-border/50 p-3 font-sans ${className}`}>
      <Identidade escritaLigada={escritaLigada} />

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col gap-4 mt-2">
        {grupos.map((grupo, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {grupo.titulo && (
              <span className="px-2.5 mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">
                {grupo.titulo}
              </span>
            )}
            {grupo.itens.map((item) => (
              <Item key={item.titulo} item={item} aoAgir={aoAgir} />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-border/50 flex flex-col gap-0.5">
        {rodape.map((item) => (
          <Item key={item.titulo} item={item} aoAgir={aoAgir} />
        ))}
        <div className="px-2.5 pt-2 text-[11px] text-muted-foreground/60 truncate" title={email}>
          {email}
        </div>
      </div>
    </div>
  )
}
