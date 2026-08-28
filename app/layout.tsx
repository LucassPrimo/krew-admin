import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

import './globals.css'

export const metadata: Metadata = {
  title: 'Krew Admin',
  // O painel não deve ser encontrável. Isto acompanha o X-Robots-Tag do
  // next.config.ts e o robots.txt — três lugares porque cada um cobre um
  // caminho diferente de descoberta.
  robots: { index: false, follow: false, nocache: true },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /**
   * O provedor do next-intl mora na RAIZ, e não na rota da oferta.
   *
   * As telas de bio foram copiadas do produto sem alterar uma linha, e lá
   * dentro existem componentes de cliente que chamam `useTranslations` — o
   * `ToggleBio` é um deles. `getRequestConfig` sozinho só atende o lado
   * SERVIDOR; sem este provedor, o primeiro componente de cliente a pedir uma
   * tradução estoura em tempo de execução ("context from NextIntlClientProvider
   * was not found"), o que é um erro que só aparece ABRINDO a tela — o build e
   * o `tsc` passam limpos.
   *
   * Vai a lista INTEIRA de mensagens, e não só o namespace que hoje é usado
   * (`bioConfig`): o painel existe para receber arquivos copiados do produto, e
   * recortar namespaces transformaria a próxima cópia no mesmo erro de tempo de
   * execução. São ~70KB de JSON numa ferramenta interna de uma pessoa; o
   * conteúdo é texto de interface, sem nada sensível.
   */
  const messages = await getMessages()

  // `className="dark"` fixo: o painel não tem tema claro, e é a classe que faz
  // a variante `dark:` do Tailwind valer independentemente do tema do sistema
  // de quem abre — sem ela, quem estiver no claro perde os estados de hover.
  return (
    <html lang="pt-BR" className="dark">
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
