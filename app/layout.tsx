import type { Metadata } from 'next'
import { DM_Mono, DM_Sans, Inter, Syne } from 'next/font/google'
import './globals.css'

// Mesmas fontes do produto principal: Inter em títulos, DM Sans no corpo,
// DM Mono em dado tabular/labels, Syne exclusiva do wordmark "Krew". Ver
// KREW_DESIGN_SYSTEM.md §2.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', weight: ['600', '700', '800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['400', '500'] })
const dmMono = DM_Mono({ subsets: ['latin'], variable: '--font-dm-mono', weight: ['400', '500'] })
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['700', '800'] })

export const metadata: Metadata = {
  title: 'Krew Admin',
  // Cinto e suspensório com o header `X-Robots-Tag` do next.config.
  robots: { index: false, follow: false, nocache: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${dmSans.variable} ${dmMono.variable} ${syne.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
