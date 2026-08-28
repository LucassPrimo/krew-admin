'use client'

import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { useState } from 'react'

/**
 * Os campos da tela de bio, com a mesma aparência do `/profile` do krew-app.
 *
 * Os valores (altura 10, canto `lg`, botão pílula, ✓ no salvar) são copiados de
 * lá em vez de reinventados: as duas telas editam a MESMA página, e uma
 * diferença de forma faria parecer que editam coisas diferentes.
 *
 * As classes são as semânticas (`bg-card`, `border-border`, `text-primary`),
 * que aqui apontam para a paleta escura do painel pela ponte de tokens do
 * `globals.css`. Mesmo desenho, pele do admin.
 */

const INPUT =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary'

const AREA =
  'w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary'

export function Campo({
  rotulo, valor, aoMudar, placeholder, maxLength, mono = false, dica, nome,
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  placeholder?: string
  maxLength?: number
  mono?: boolean
  dica?: React.ReactNode
  nome?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground">{rotulo}</label>
      <input
        name={nome} value={valor} onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        className={`${INPUT} ${mono ? 'font-mono text-xs' : ''}`}
      />
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  )
}

export function CampoArea({
  rotulo, valor, aoMudar, placeholder, maxLength, linhas = 3, mono = false, dica, nome,
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  placeholder?: string
  maxLength?: number
  linhas?: number
  mono?: boolean
  dica?: React.ReactNode
  nome?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground">{rotulo}</label>
      <textarea
        name={nome} value={valor} onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder} maxLength={maxLength} rows={linhas}
        className={`${AREA} ${mono ? 'font-mono text-xs' : ''}`}
      />
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  )
}

export function BotaoSalvar({
  aoClicar, pendente, salvo, desabilitado, rotulo = 'Salvar', tipo = 'button',
}: {
  aoClicar?: () => void
  pendente?: boolean
  salvo?: boolean
  desabilitado?: boolean
  rotulo?: string
  tipo?: 'button' | 'submit'
}) {
  return (
    <button
      type={tipo} onClick={aoClicar} disabled={pendente || desabilitado}
      className="flex items-center gap-1.5 self-start rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
    >
      {pendente
        ? <Loader2 className="size-3.5 animate-spin" />
        : <Check className="size-3.5" />}
      {salvo ? 'Salvo' : rotulo}
    </button>
  )
}

/**
 * A fileira de cores de fundo, com as mesmas amostras do produto.
 *
 * As amostras não limitam a escolha — o `<input type="color">` ao lado abre o
 * seletor do sistema. Elas existem para dispensar a decisão, não para cercá-la.
 */
export const CORES_FUNDO = [
  { valor: '#000000', nome: 'preto' },
  { valor: '#0B0B0C', nome: 'grafite' },
  { valor: '#12212B', nome: 'petróleo' },
  { valor: '#1B1230', nome: 'ameixa' },
  { valor: '#2A1114', nome: 'vinho' },
  { valor: '#0E2018', nome: 'floresta' },
  { valor: '#F2EDE4', nome: 'areia' },
  { valor: '#FFFFFF', nome: 'branco' },
] as const

export function SeletorCor({
  cor, aoEscolher,
}: { cor: string; aoEscolher: (c: string) => void }) {
  const personalizada = !CORES_FUNDO.some((c) => c.valor.toUpperCase() === cor.toUpperCase())

  return (
    <div className="flex flex-wrap items-center gap-2">
      {CORES_FUNDO.map((c) => (
        <button
          key={c.valor} type="button" onClick={() => aoEscolher(c.valor)}
          aria-label={c.nome} title={c.nome}
          className={`size-7 rounded-full border-2 transition-transform ${
            c.valor.toUpperCase() === cor.toUpperCase()
              ? 'border-primary scale-110'
              : 'border-border hover:scale-105'
          }`}
          style={{ backgroundColor: c.valor }}
        />
      ))}

      <label
        className={`flex size-7 cursor-pointer items-center justify-center rounded-full border-2 ${
          personalizada ? 'border-primary' : 'border-border'
        }`}
        style={{ backgroundColor: personalizada ? cor : 'transparent' }}
        title="Escolher outra cor"
      >
        <input
          type="color" value={cor} onChange={(e) => aoEscolher(e.target.value.toUpperCase())}
          className="size-0 opacity-0"
        />
        {!personalizada && <span className="text-[10px] text-muted-foreground">+</span>}
      </label>

      <span className="font-mono text-xs text-muted-foreground">{cor}</span>
    </div>
  )
}

/**
 * A barra do endereço público, no topo da tela — a mesma peça do `/profile`.
 *
 * O endereço fica VISÍVEL e copiável, não escondido atrás de um ícone: é o
 * link que você vai colar numa mensagem para o criador, e conferir o que
 * copiou é parte do trabalho.
 */
export function BarraEndereco({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false)
  const url = `https://bekrew.com/@${slug}`

  function copiar() {
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    })
  }

  return (
    <div className="mb-4 flex w-fit items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5">
      <span className="text-xs font-medium text-muted-foreground">Link da bio</span>
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <a
        href={url} target="_blank" rel="noreferrer"
        className="flex items-center gap-1 text-sm font-semibold text-foreground transition-colors hover:text-primary"
      >
        <span className="max-w-[16rem] truncate">bekrew.com/@{slug}</span>
        <ExternalLink className="size-3.5 shrink-0" />
      </a>
      <button
        type="button" onClick={copiar} title={copiado ? 'Copiado' : 'Copiar'}
        aria-label={copiado ? 'Copiado' : 'Copiar'}
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copiado
          ? <Check className="size-3.5 text-primary" />
          : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}
