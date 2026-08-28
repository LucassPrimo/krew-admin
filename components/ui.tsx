import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Componentes caseiros, de propósito.
 *
 * Regra de dependência do plano: cada pacote novo é uma chave a mais na
 * fechadura de outra pessoa — e este é o app que alcança o dado de todos os
 * clientes. Uma biblioteca de UI traz dezenas de pacotes transitivos para
 * resolver o que aqui são cinco componentes de layout.
 */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-borda bg-painel p-4 ${className}`}>{children}</div>
  )
}

export function Titulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h1 className="text-lg font-medium">{children}</h1>
      {acao}
    </div>
  )
}

/** Número grande com rótulo. A unidade de leitura do dashboard. */
export function Metrica({
  rotulo, valor, nota, alerta = false,
}: { rotulo: string; valor: string; nota?: string; alerta?: boolean }) {
  return (
    <div className="rounded-lg border border-borda bg-painel p-4">
      <div className="text-xs text-texto-fraco">{rotulo}</div>
      <div className={`mt-1 text-2xl font-medium tabular-nums ${alerta ? 'text-perigo' : ''}`}>
        {valor}
      </div>
      {nota && <div className="mt-1 text-xs text-texto-fraco">{nota}</div>}
    </div>
  )
}

export function Badge({
  children, tom = 'neutro',
}: { children: ReactNode; tom?: 'neutro' | 'ok' | 'aviso' | 'perigo' }) {
  const cores = {
    neutro: 'border-borda-forte text-texto-fraco',
    ok: 'border-ok/40 text-ok',
    aviso: 'border-aviso/40 text-aviso',
    perigo: 'border-perigo/40 text-perigo',
  }
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[11px] ${cores[tom]}`}>
      {children}
    </span>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-texto-fraco">{children}</p>
}

export function Aviso({
  children, tom = 'aviso',
}: { children: ReactNode; tom?: 'aviso' | 'perigo' }) {
  const cor = tom === 'perigo' ? 'border-perigo/40 bg-perigo-fundo' : 'border-acento/40 bg-acento/5'
  return <div className={`rounded-md border px-3 py-2 text-sm ${cor}`}>{children}</div>
}

export function LinkInterno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-acento underline-offset-2 hover:underline">
      {children}
    </Link>
  )
}

/**
 * Valor de uma coluna numa tabela densa.
 *
 * `mono` para id, token e número: são valores que a pessoa COMPARA (é o mesmo
 * uuid?) ou copia, e fonte proporcional atrapalha as duas coisas.
 */
export function Valor({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  if (children === null || children === undefined || children === '') {
    return <span className="text-texto-fraco">—</span>
  }
  return <span className={mono ? 'font-mono text-xs' : ''}>{children}</span>
}
