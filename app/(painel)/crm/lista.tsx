'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Vazio } from '@/components/ui'
import { numero } from '@/lib/format'
import { casaBusca, type Lead } from '@/lib/crm-tipos'
import { TabelaLeads } from './tabela'

/**
 * A busca da lista, filtrando enquanto você digita.
 *
 * ---------------------------------------------------------------------------
 * Por que dá para filtrar sem ir ao servidor
 * ---------------------------------------------------------------------------
 * Porque a página JÁ tem todos os leads em mãos: `listarLeads()` traz a
 * prospecção inteira a cada carregamento — é uma decisão antiga e deliberada
 * (ver a nota dela em `lib/crm.ts`), tomada porque o estágio efetivo é
 * calculado em TypeScript e não caberia num `where` sem duplicar a regra
 * dentro do banco.
 *
 * Essa escolha tinha um efeito colateral bobo: a busca era um formulário que
 * exigia Enter e uma volta ao servidor para filtrar uma lista que já estava na
 * memória do navegador. Agora ela filtra na hora, e a consulta ao banco que
 * cada tecla causava simplesmente deixou de existir — é mais rápido E mais
 * barato, o que raramente acontece junto.
 *
 * ---------------------------------------------------------------------------
 * A URL continua contando a verdade
 * ---------------------------------------------------------------------------
 * O `?q=` é atualizado meio segundo depois da última tecla, com `replace` (não
 * `push`): a propriedade que esta tela sempre teve — mandar "olha os do Link
 * School parados" por link — vale para a busca também, e o botão voltar não
 * vira um desfazer letra por letra.
 *
 * O servidor NÃO filtra por `q`. É o que garante que apagar a busca devolva a
 * lista no mesmo instante, sem esperar o `replace`: o que o cliente recebe é
 * sempre o conjunto inteiro do filtro de abas, e o texto só recorta em cima.
 */
export function ListaLeads({
  leads, totalGeral, qInicial, semLeadsNoBanco, podeAgir, podeExcluir, abas,
}: {
  /** Já filtrados por aba/fonte/hoje no servidor — o texto é recorte de cima. */
  leads: Lead[]
  totalGeral: number
  qInicial: string
  semLeadsNoBanco: boolean
  podeAgir: boolean
  podeExcluir: boolean
  /** As abas, renderizadas no servidor: são `Link`s e não precisam de cliente. */
  abas: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const parametros = useSearchParams()
  const [termo, setTermo] = useState(qInicial)

  /**
   * O último texto que ESTA tela mandou para a URL.
   *
   * Existe por causa de uma corrida real: a sincronização é adiada, então o
   * `?q=manu` chega de volta meio segundo depois — e se, nesse meio tempo,
   * você já tiver digitado "manual", ler a URL de volta apagaria as duas
   * letras novas. Guardando o que foi enviado, o retorno do próprio envio é
   * ignorado; o que continua valendo é a mudança que vem de FORA (botão
   * voltar, um link colado, a troca de aba).
   */
  const ultimoEnviado = useRef(qInicial)

  /**
   * A URL é ESPELHO do que você digitou, e por isso a sincronização é adiada.
   *
   * Sem o atraso, cada tecla empurraria uma navegação — que num layout
   * `force-dynamic` significa a página inteira renderizada de novo no servidor
   * para não mudar nada na tela, já que a filtragem acontece aqui.
   */
  useEffect(() => {
    // Comparação com `trim` dos dois lados: a URL nunca guarda o espaço solto
    // que você acabou de digitar, e comparar com ele faria a condição nunca
    // bater — um `replace` para o mesmo endereço a cada meio segundo enquanto
    // o espaço estivesse na caixa.
    const atual = parametros.get('q') ?? ''
    if (termo.trim() === atual) return

    const t = setTimeout(() => {
      ultimoEnviado.current = termo.trim()
      const p = new URLSearchParams(parametros.toString())
      if (termo.trim()) p.set('q', termo.trim())
      else p.delete('q')
      const busca = p.toString()
      router.replace(busca ? `${pathname}?${busca}` : pathname, { scroll: false })
    }, 500)
    return () => clearTimeout(t)
  }, [termo, parametros, pathname, router])

  // Quem chega por link com `?q=` já vê filtrado; trocar de aba mantém o texto.
  // O eco do próprio envio é ignorado — ver `ultimoEnviado`.
  useEffect(() => {
    const daUrl = parametros.get('q') ?? ''
    if (daUrl === ultimoEnviado.current) return
    ultimoEnviado.current = daUrl
    setTermo(daUrl)
  }, [parametros])

  const filtrados = useMemo(() => leads.filter((l) => casaBusca(l, termo)), [leads, termo])

  const fonte = parametros.get('fonte')
  const filtrando =
    Boolean(termo.trim()) || Boolean(fonte) || Boolean(parametros.get('estagio')) ||
    parametros.get('hoje') === '1'

  return (
    <>
      {/* ------------------------------------------------------------------
          O filtro é uma fileira de abas e uma busca — não um formulário com
          três selects e um botão "filtrar". Cada aba já traz o número, então
          a barra também RESPONDE ("tem sete parados em negociando") em vez
          de só perguntar.
          ------------------------------------------------------------------ */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {abas}

        <div className="ml-auto flex h-8 items-center gap-1.5 rounded-full border border-borda bg-fundo px-3 focus-within:border-borda-forte">
          <Search className="size-3.5 shrink-0 text-texto-fraco" strokeWidth={1.5} />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            // Esc limpa: é o gesto que a pessoa já tenta, e sem ele a única
            // saída era apagar caractere por caractere.
            onKeyDown={(e) => { if (e.key === 'Escape') setTermo('') }}
            placeholder="nome, @, fonte"
            aria-label="Buscar lead"
            className="w-40 bg-transparent text-xs outline-none placeholder:text-texto-fraco"
          />
          {termo && (
            <button
              type="button"
              onClick={() => setTermo('')}
              aria-label="Limpar busca"
              className="text-texto-fraco hover:text-texto"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {filtrando && (
        <p className="mb-3 text-xs text-texto-fraco">
          {numero(filtrados.length)} de {numero(totalGeral)}
          {fonte && <> · fonte <span className="text-texto">{fonte}</span></>}
          {termo.trim() && <> · busca <span className="text-texto">{termo.trim()}</span></>}
          {' · '}
          <Link href="/crm" className="text-acento hover:underline">limpar</Link>
        </p>
      )}

      {filtrados.length === 0 ? (
        <Vazio>
          {semLeadsNoBanco
            ? 'Nenhum lead ainda. Comece pelo botão "Novo lead".'
            : termo.trim()
              ? `Nenhum lead com "${termo.trim()}".`
              : 'Nenhum lead com esse filtro.'}
        </Vazio>
      ) : (
        <TabelaLeads leads={filtrados} podeAgir={podeAgir} podeExcluir={podeExcluir} />
      )}
    </>
  )
}
