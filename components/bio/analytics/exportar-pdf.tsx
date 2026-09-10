'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FileText, LoaderCircle, X } from 'lucide-react'
import { PERIODOS_PDF, ROTULOS_PDF } from '@/lib/analytics/pdf/dados'
import type { Periodo } from '@/lib/bio/periodo'

export function ExportarPdf({ pageId }: { pageId: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancelamento = useRef<AbortController | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [baixado, setBaixado] = useState(false)

  useEffect(() => () => cancelamento.current?.abort(), [])

  async function baixar() {
    setGerando(true)
    setErro('')
    setBaixado(false)
    const controller = new AbortController()
    cancelamento.current = controller
    try {
      const resposta = await fetch(`/api/analytics/${pageId}/pdf?periodo=${periodo}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]), cache: 'no-store',
      })
      if (!resposta.ok || !resposta.headers.get('content-type')?.includes('application/pdf')) {
        throw new Error('Não foi possível gerar o PDF. Confira sua sessão e tente novamente.')
      }
      const arquivo = await resposta.blob()
      const url = URL.createObjectURL(arquivo)
      const link = document.createElement('a')
      link.href = url
      link.download = resposta.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'krew-analytics.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setBaixado(true)
    } catch (e) {
      if (!controller.signal.aborted) setErro(e instanceof Error ? e.message : 'Tente novamente.')
    } finally {
      if (!controller.signal.aborted) setGerando(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => {
        setPeriodo('30d'); setErro(''); setBaixado(false); dialog.current?.showModal()
      }} className="inline-flex items-center gap-2 rounded-full bg-mint px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
        <Download className="size-4" aria-hidden /> Baixar relatório PDF
      </button>
      <dialog ref={dialog} aria-labelledby="pdf-titulo"
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/70"
        onCancel={(e) => { if (gerando) e.preventDefault() }}>
        <div className="p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-mint/15 text-mint"><FileText className="size-5" aria-hidden /></div>
            <button type="button" aria-label="Fechar" disabled={gerando} onClick={() => dialog.current?.close()} className="rounded-full p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"><X className="size-4" /></button>
          </div>
          <h2 id="pdf-titulo" className="text-xl font-semibold tracking-tight">Sua performance, pronta para compartilhar.</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Um relatório Krew com capa, gráficos, links e audiência. Os dados são atualizados ao gerar o arquivo.</p>
          <fieldset disabled={gerando} className="mt-6">
            <legend className="mb-2 text-sm font-medium">Período do relatório</legend>
            <div className="flex flex-col gap-2">
              {PERIODOS_PDF.map((p) => (
                <label key={p} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${p === periodo ? 'border-mint bg-mint/10' : 'border-border'}`}>
                  <input type="radio" name="periodo-pdf" value={p} checked={p === periodo} onChange={() => { setPeriodo(p); setBaixado(false) }} className="accent-[#0a9a7d]" />
                  <span className="flex-1">{ROTULOS_PDF[p]}</span>
                  {p === '30d' && <span className="text-xs text-muted-foreground">Padrão</span>}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-3 text-xs text-muted-foreground">Horário de Brasília. A comparação usa o período anterior de mesma duração.</p>
          {erro && <p role="alert" className="mt-4 text-sm text-perigo">{erro}</p>}
          <p role="status" aria-live="polite" className="mt-4 text-sm text-mint">{baixado ? 'PDF pronto! O download foi iniciado.' : gerando ? 'Preparando seu relatório...' : ''}</p>
          <button type="button" disabled={gerando} onClick={baixar} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-mint px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {gerando ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            {gerando ? 'Gerando PDF...' : 'Baixar PDF'}
          </button>
        </div>
      </dialog>
    </>
  )
}
