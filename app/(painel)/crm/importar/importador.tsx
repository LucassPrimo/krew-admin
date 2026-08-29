'use client'

import { AlertTriangle, Check, Download, FileUp, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import { Aviso, Card, Vazio } from '@/components/ui'
import { COLUNAS_MODELO, type Plano } from '@/lib/crm-importar'
import { ROTULO } from '@/lib/crm-tipos'
import { acaoImportarLeads, acaoPreverImportacao } from '../acoes'

/**
 * Colar, conferir, gravar — nessa ordem, e a do meio não se pula.
 *
 * A prévia não é enfeite: importação é o gesto em que o engano é mais fácil de
 * cometer (coluna trocada, arquivo errado, a mesma lista colada duas vezes) e
 * mais caro de desfazer, porque não existe DELETE no painel. Ver as linhas
 * marcadas uma a uma antes de gravar é o que torna isso reversível na prática.
 *
 * Quem confere é o SERVIDOR, com o mesmo parser que grava — a tela só desenha
 * o que ele respondeu. Um parser no navegador para a prévia e outro no
 * servidor para a escrita divergiriam, e o lugar onde isso apareceria seria
 * depois de importar duzentas linhas.
 */

const MOSTRAR = 200

export function Importador({ podeEscrever }: { podeEscrever: boolean }) {
  const router = useRouter()
  const arquivo = useRef<HTMLInputElement>(null)
  const [pendente, iniciar] = useTransition()

  const [texto, setTexto] = useState('')
  const [plano, setPlano] = useState<Plano | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<{ criados: number; ignorados: number } | null>(null)

  function conferir(conteudo = texto) {
    setErro(null)
    setFeito(null)
    iniciar(async () => {
      const r = await acaoPreverImportacao(conteudo)
      setPlano(r)
    })
  }

  function abrirArquivo(f: File) {
    f.text().then((conteudo) => {
      setTexto(conteudo)
      conferir(conteudo)
    })
  }

  function importar() {
    setErro(null)
    iniciar(async () => {
      const r = await acaoImportarLeads(texto)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setFeito({ criados: r.criados, ignorados: r.ignorados })
      setPlano(null)
      setTexto('')
      router.refresh()
    })
  }

  if (feito) {
    return (
      <Card>
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-medium">
          <Check className="size-4" strokeWidth={2} />
          {feito.criados} lead(s) importados
        </h2>
        <p className="mb-3 text-xs text-texto-fraco">
          {feito.ignorados > 0
            ? `${feito.ignorados} linha(s) ficaram de fora — duplicadas ou sem nome.`
            : 'Nenhuma linha ficou de fora.'}{' '}
          Quem tinha o handle de uma bio já criada nasceu vinculado a ela.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button" onClick={() => router.push('/crm')}
            className="rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-fundo"
          >
            Ver os leads
          </button>
          <button
            type="button" onClick={() => setFeito(null)}
            className="text-sm text-texto-fraco hover:text-texto"
          >
            importar outra planilha
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">A planilha</h2>
            <p className="text-xs text-texto-fraco">
              Colunas em qualquer ordem, com ou sem acento. A primeira linha
              precisa ser o cabeçalho.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/modelo-leads.csv" download
              className="flex items-center gap-1.5 rounded-full border border-borda px-3 py-1.5 text-xs transition-colors hover:border-borda-forte"
            >
              <Download className="size-3.5" strokeWidth={1.5} />
              Baixar o modelo
            </a>
            <button
              type="button" onClick={() => arquivo.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-borda px-3 py-1.5 text-xs transition-colors hover:border-borda-forte"
            >
              <FileUp className="size-3.5" strokeWidth={1.5} />
              Escolher arquivo
            </button>
            {/* O arquivo é lido NO NAVEGADOR e vira o mesmo texto que você
                colaria: não há upload, e o caminho de gravação é um só. */}
            <input
              ref={arquivo} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) abrirArquivo(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <p className="mb-2 flex flex-wrap gap-1.5">
          {COLUNAS_MODELO.map((c) => (
            <span
              key={c}
              className="rounded-full border border-borda px-2 py-0.5 font-mono text-[11px] text-texto-fraco"
            >
              {c}
            </span>
          ))}
        </p>

        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setPlano(null)
          }}
          rows={8}
          placeholder={`Nome\tInstagram\tFonte\tHandle da bio\n${'Maite Pizza\tmaiipizza\tLink School\tmaipizza'}`}
          className="w-full resize-y rounded-lg border border-borda bg-fundo px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-borda-forte"
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button" onClick={() => conferir()} disabled={pendente || !texto.trim()}
            className="flex items-center gap-1.5 rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-fundo disabled:opacity-40"
          >
            {pendente && <Loader2 className="size-3.5 animate-spin" />}
            Conferir
          </button>
          {texto && (
            <button
              type="button" onClick={() => { setTexto(''); setPlano(null) }}
              className="text-sm text-texto-fraco hover:text-texto"
            >
              limpar
            </button>
          )}
        </div>
      </Card>

      {erro && <Aviso tom="perigo">{erro}</Aviso>}

      {plano && (
        <Card>
          <h2 className="mb-1 text-sm font-medium">O que vai acontecer</h2>
          <p className="mb-3 text-xs text-texto-fraco">
            Nada foi gravado ainda. Só as linhas marcadas como
            &ldquo;criar&rdquo; entram.
          </p>

          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-acento/50 px-2.5 py-1 text-xs">
              {plano.criar} para criar
            </span>
            {plano.duplicados > 0 && (
              <span className="rounded-full border border-borda-forte px-2.5 py-1 text-xs text-texto-fraco">
                {plano.duplicados} já no CRM
              </span>
            )}
            {plano.erros > 0 && (
              <span className="rounded-full border border-perigo/40 px-2.5 py-1 text-xs text-perigo">
                {plano.erros} com problema
              </span>
            )}
          </div>

          {plano.avisos.map((a) => (
            <p
              key={a}
              className="mb-2 flex gap-2 rounded-lg border border-borda bg-painel-2 px-3 py-2 text-xs text-texto-fraco"
            >
              <AlertTriangle className="mt-px size-3.5 shrink-0" strokeWidth={1.5} />
              {a}
            </p>
          ))}

          {plano.linhas.length === 0 ? (
            <Vazio>Nenhuma linha de dado encontrada.</Vazio>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto">
                <table className="densa">
                  <thead>
                    <tr>
                      <th className="w-8">#</th><th>Nome</th><th>Instagram</th>
                      <th>Fonte</th><th>Bio</th><th>Estágio</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plano.linhas.slice(0, MOSTRAR).map((l) => (
                      <tr key={l.linha} className={l.acao === 'criar' ? '' : 'opacity-60'}>
                        <td className="tabular-nums text-texto-fraco">{l.linha}</td>
                        <td>{l.nome || <span className="text-texto-fraco">—</span>}</td>
                        <td className="font-mono text-xs text-texto-fraco">
                          {l.instagram ? `@${l.instagram}` : '—'}
                        </td>
                        <td className="text-texto-fraco">{l.fonte ?? '—'}</td>
                        <td className="font-mono text-xs text-texto-fraco">
                          {l.handle ? `@${l.handle}` : '—'}
                          {l.vincula && (
                            <span className="ml-1.5 font-sans text-[11px] text-texto">
                              vincula
                            </span>
                          )}
                        </td>
                        <td className="text-texto-fraco">{ROTULO[l.estagio]}</td>
                        <td className="whitespace-nowrap">
                          {l.acao === 'criar' ? (
                            <span className="flex items-center gap-1 text-xs">
                              <Check className="size-3.5" strokeWidth={2} />
                              criar
                            </span>
                          ) : (
                            <span
                              className={`flex items-center gap-1 text-xs ${
                                l.acao === 'erro' ? 'text-perigo' : 'text-texto-fraco'
                              }`}
                            >
                              <X className="size-3.5" strokeWidth={2} />
                              {l.erro}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {plano.linhas.length > MOSTRAR && (
                <p className="mt-2 text-xs text-texto-fraco">
                  Mostrando as {MOSTRAR} primeiras de {plano.linhas.length}. O
                  resumo acima conta todas.
                </p>
              )}
            </>
          )}

          <div className="mt-4 flex items-center gap-3 border-t border-borda pt-3">
            <button
              type="button" onClick={importar}
              disabled={pendente || !podeEscrever || plano.criar === 0}
              className="flex items-center gap-1.5 rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-fundo disabled:opacity-40"
            >
              {pendente && <Loader2 className="size-3.5 animate-spin" />}
              Importar {plano.criar} lead{plano.criar === 1 ? '' : 's'}
            </button>
            {!podeEscrever && (
              <span className="text-xs text-texto-fraco">
                a escrita está desligada neste deploy
              </span>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
