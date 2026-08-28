'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { saveSocialNetworks } from '@/app/actions/social-networks'
import {
  CATEGORIAS,
  PLATFORMS,
  PlatformIcon,
  normalizarHandle,
  normalizarUrl,
  type Categoria,
  type PlatformId,
} from '@/components/bio/platforms'

/**
 * A chave de tradução de cada gaveta.
 *
 * Um mapa explícito, e não `` `categoria${cat}` ``: chave montada por
 * concatenação some do `grep`, e o dia em que uma categoria for renomeada o
 * rótulo simplesmente vira a própria chave em tela, sem erro de build.
 */
const ROTULO_CATEGORIA: Record<Categoria, string> = {
  social: 'categoriaSocial',
  negocios: 'categoriaNegocios',
  musica: 'categoriaMusica',
  pagamento: 'categoriaPagamento',
  entretenimento: 'categoriaEntretenimento',
  estilo: 'categoriaEstilo',
  outros: 'categoriaOutros',
}

function rotuloCategoria(cat: Categoria) {
  return ROTULO_CATEGORIA[cat]
}

/**
 * Uma bolinha da fileira.
 *
 * Extraída porque ela aparece em DOIS lugares — nas redes já escolhidas e
 * dentro da gaveta aberta — e duas cópias do mesmo botão divergiriam no
 * primeiro ajuste de estado visual.
 */
function Bolinha({
  def,
  preenchida,
  aberta,
  aoClicar,
}: {
  def: (typeof PLATFORMS)[number]
  preenchida: boolean
  aberta: boolean
  aoClicar: (id: PlatformId) => void
}) {
  return (
    <button
      type="button"
      onClick={() => aoClicar(def.id)}
      aria-pressed={preenchida}
      aria-expanded={aberta}
      // O nome só no `title`/`aria-label`: o rótulo embaixo de cada bolinha
      // dobrava a altura da fileira para repetir o que o desenho da marca já
      // diz.
      aria-label={def.label}
      title={def.label}
      className={cn(
        'relative rounded-full transition-all duration-200',
        preenchida
          ? 'opacity-100 hover:scale-105'
          : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0',
        aberta && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
      )}
    >
      <PlatformIcon def={def} className="size-11 rounded-full" />
      {preenchida && (
        <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-card p-[2px]">
          <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="size-2.5" />
          </span>
        </span>
      )}
    </button>
  )
}

interface RedeEditavel {
  platform: string
  handle: string
  url: string | null
  ordem?: number | null
  ativo?: boolean | null
}

/**
 * As redes da bio: uma fileira de bolinhas, e o campo abre na que se clica.
 *
 * O desenho é a própria fileira da página pública — as mesmas marcas, na mesma
 * forma redonda. Quem já está preenchido aparece em cor cheia; o resto fica
 * apagado e sem cor. Assim a pergunta "o que falta?" se responde olhando, sem
 * ler uma lista de "tal rede → tal link" embaixo, que era a mesma informação
 * escrita duas vezes.
 *
 * O campo abre INLINE, logo abaixo da bolinha clicada, e não num diálogo: um
 * modal cobre justamente a fileira que dá o contexto ("já pus Instagram e
 * TikTok, falta o YouTube"), e fecha a cada rede, o que transforma preencher
 * três redes em três aberturas e três fechamentos.
 *
 * Salva o conjunto INTEIRO a cada confirmação, porque é isso que
 * `saveSocialNetworks` faz (ver a action): ela troca a lista toda de uma vez.
 * Por isso o estado local carrega todas as redes, e não só a que está aberta.
 */
export function BioRedesCard({ redesIniciais }: { redesIniciais: RedeEditavel[] }) {
  const t = useTranslations('bioConfig')
  const [pendente, iniciar] = useTransition()
  const [salvo, setSalvo] = useState(false)
  const [redes, setRedes] = useState<RedeEditavel[]>(
    redesIniciais.map((r) => ({ ...r, url: r.url ?? '' }))
  )

  const [aberta, setAberta] = useState<PlatformId | null>(null)
  /** A gaveta aberta. `null` mostra a lista de gavetas. */
  const [gaveta, setGaveta] = useState<Categoria | null>(null)
  const [valor, setValor] = useState('')

  const def = aberta ? (PLATFORMS.find((p) => p.id === aberta) ?? null) : null
  // `href` é o que separa as duas famílias: rede com endereço previsível pede
  // só o @; site e afins pedem a URL inteira. Ver `platforms.tsx`.
  const pedeHandle = !!def?.href

  function abrir(id: PlatformId) {
    if (aberta === id) {
      setAberta(null)
      return
    }
    const atual = redes.find((r) => r.platform === id)
    const defDaRede = PLATFORMS.find((p) => p.id === id)
    setValor(atual ? (defDaRede?.href ? atual.handle : (atual.url ?? '')) : '')
    setAberta(id)
  }

  /** Devolve a lista com esta rede aplicada — vazia significa remover. */
  function comRede(lista: RedeEditavel[], id: PlatformId, bruto: string) {
    const defDaRede = PLATFORMS.find((p) => p.id === id)
    const ehHandle = !!defDaRede?.href
    const limpo = ehHandle ? normalizarHandle(bruto) : normalizarUrl(bruto)

    if (!limpo) return lista.filter((r) => r.platform !== id)

    const nova: RedeEditavel = {
      platform: id,
      handle: ehHandle ? limpo : '',
      url: ehHandle ? null : limpo,
      ativo: true,
    }
    return lista.some((r) => r.platform === id)
      ? lista.map((r) => (r.platform === id ? { ...r, ...nova } : r))
      : [...lista, nova]
  }

  function confirmar(bruto: string) {
    if (!aberta) return
    const proxima = comRede(redes, aberta, bruto)
    setRedes(proxima)
    setAberta(null)
    gravar(proxima)
  }

  function gravar(lista: RedeEditavel[]) {
    iniciar(async () => {
      await saveSocialNetworks(
        lista.map((r, i) => ({
          platform: r.platform,
          handle: r.handle,
          url: r.url || null,
          ordem: i,
          ativo: true,
        }))
      )
      setSalvo(true)
      setTimeout(() => setSalvo(false), 1500)
    })
  }

  /**
   * As bolinhas agrupadas por categoria, na ordem de `CATEGORIAS`.
   *
   * Com uma dezena de redes a fileira única funcionava: cabia em duas linhas e
   * dava para varrer de olho. Com quase sessenta ela virou um paredão em que
   * achar o Spotify custa mais do que digitar o endereço dele à mão — que é o
   * oposto do que a fileira existe para fazer.
   *
   * A contagem ao lado do título é o que já está PREENCHIDO naquela gaveta, e
   * não o total dela. O total é a mesma informação que as bolinhas visíveis já
   * dão; o preenchido responde "falta alguma coisa aqui?" sem abrir nada.
   */
  // Na ordem do PRÓPRIO criador (`ordem` da rede), e não na ordem do catálogo:
  // esta fileira é a página dele, e vê-la fora de ordem aqui atrapalharia
  // justamente quem veio conferir como ela ficou.
  const escolhidas = redes
    .filter((r) => r.handle || r.url)
    .map((r) => PLATFORMS.find((p) => p.id === r.platform))
    .filter((p): p is (typeof PLATFORMS)[number] => !!p)

  const grupos = CATEGORIAS.map((cat) => {
    const itens = PLATFORMS.filter((p) => p.categoria === cat)
    const preenchidas = itens.filter((p) => {
      const r = redes.find((x) => x.platform === p.id)
      return !!(r?.handle || r?.url)
    }).length
    return { cat, itens, preenchidas }
  }).filter((g) => g.itens.length > 0)

  return (
    <div className="flex flex-col gap-3">
      {/* O que JÁ está na página, sempre à mão.
          Sem isto, editar o Instagram que você acabou de pôr custaria lembrar
          em qual gaveta ele mora — e as redes preenchidas são justamente as
          que se mexe de novo. Elas aparecem aqui além de aparecerem na
          gaveta delas; é repetição de propósito, porque as duas perguntas
          ("o que já tem?" e "onde acho o X?") são diferentes. */}
      {escolhidas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {escolhidas.map((p) => (
            <Bolinha key={p.id} def={p} preenchida aberta={aberta === p.id} aoClicar={abrir} />
          ))}
        </div>
      )}

      {gaveta === null ? (
        /* Nível 1: as gavetas. Sessenta bolinhas abertas de uma vez viram um
           paredão em que achar o Spotify custa mais do que digitar o endereço
           dele à mão — que é o oposto do que a fileira existe para fazer.
           Aqui cabem sete linhas, e cada uma diz quantas redes tem dentro. */
        <div className="flex flex-col gap-1">
          {grupos.map(({ cat, itens, preenchidas }) => (
            <button
              key={cat}
              type="button"
              onClick={() => { setGaveta(cat); setAberta(null) }}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted"
            >
              <span className="text-sm font-medium text-foreground">{t(rotuloCategoria(cat))}</span>
              {preenchidas > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                  {preenchidas}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                {itens.length}
                <ChevronRight className="size-3.5" />
              </span>
            </button>
          ))}
        </div>
      ) : (
        /* Nível 2: a gaveta aberta. O caminho no topo é clicável e devolve
           para a lista — é a única saída, então ele não pode ser só enfeite. */
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <button
              type="button"
              onClick={() => { setGaveta(null); setAberta(null) }}
              className="flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
              {t('redesTodas')}
            </button>
            <ChevronRight className="size-3 opacity-50" aria-hidden />
            <span className="text-foreground">{t(rotuloCategoria(gaveta))}</span>
          </p>

          <div className="flex flex-wrap gap-2">
            {PLATFORMS.filter((p) => p.categoria === gaveta).map((p) => {
              const r = redes.find((x) => x.platform === p.id)
              return (
                <Bolinha
                  key={p.id}
                  def={p}
                  preenchida={!!(r?.handle || r?.url)}
                  aberta={aberta === p.id}
                  aoClicar={abrir}
                />
              )
            })}
          </div>
        </div>
      )}

      {def && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-2">
            <PlatformIcon def={def} className="size-6 rounded-full" />
            <span className="text-sm font-semibold text-foreground">{def.label}</span>
            {redes.some((r) => r.platform === def.id) && (
              <button
                type="button"
                onClick={() => confirmar('')}
                aria-label={t('remover')}
                title={t('remover')}
                className="ml-auto flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmar(valor)
                if (e.key === 'Escape') setAberta(null)
              }}
              placeholder={pedeHandle ? t('handlePlaceholder') : t('urlPlaceholder')}
              inputMode={pedeHandle ? 'text' : 'url'}
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => confirmar(valor)}
              disabled={pendente}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pendente ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {t('salvar')}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">{t('colarUsuarioDica')}</p>
        </div>
      )}

      {/* Sem botão de salvar geral: cada rede grava ao confirmar, e o aviso
          abaixo é o recibo. Um "salvar" no pé da seção prometeria que o resto
          da tela também espera por ele — e não espera, tudo aqui grava sozinho. */}
      <p className="flex h-4 items-center gap-1.5 text-[11px] text-muted-foreground">
        {pendente && (
          <>
            <Loader2 className="size-3 animate-spin" />
            {t('salvando')}
          </>
        )}
        {!pendente && salvo && (
          <>
            <Check className="size-3 text-emerald-500" />
            {t('salvo')}
          </>
        )}
        {!pendente && !salvo && redes.length === 0 && t('redesVazio')}
      </p>
    </div>
  )
}
