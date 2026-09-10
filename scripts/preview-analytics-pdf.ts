/** npx vite-node --config vitest.config.ts scripts/preview-analytics-pdf.ts */
import { mkdir, writeFile } from 'node:fs/promises'
import { renderToBuffer } from '@react-pdf/renderer'
import { RelatorioPdf } from '../lib/analytics/pdf/relatorio'
import type { RelatorioAnalytics } from '../lib/analytics/pdf/dados'

const serie = Array.from({ length: 30 }, (_, i) => ({ dia: `2026-08-${String(i + 1).padStart(2, '0')}`, views: 180 + (i * 73 % 330), cliques: 40 + (i * 31 % 100) }))
const views = serie.reduce((s, d) => s + d.views, 0)
const cliques = serie.reduce((s, d) => s + d.cliques, 0)
const dados: RelatorioAnalytics = {
  nome: 'Marina Costa', slug: 'marinacosta', periodo: '30d', desde: '2026-08-01T15:00:00.000Z', ate: '2026-08-31T15:00:00.000Z',
  painel: {
    leve: {
      porDia: serie,
      porBotao: Array.from({ length: 18 }, (_, i) => ({ buttonId: i < 11 ? String(i) : null, buttonKind: i < 11 ? 'link' : 'rede', buttonRef: i < 11 ? null : ['instagram', 'tiktok', 'youtube', 'whatsapp', 'linkedin', 'twitter', 'spotify'][i - 11], cliques: 350 - i * 17 })),
      porDispositivo: { mobile: 7600, desktop: 1740, tablet: 500, desconhecido: 105 },
      porReferrer: [{ referrer: 'https://l.instagram.com', eventos: 4560 }, { referrer: 'direto', eventos: 2300 }, { referrer: 'https://tiktok.com', eventos: 1740 }, { referrer: 'https://youtube.com', eventos: 640 }, { referrer: 'https://google.com', eventos: 210 }, { referrer: 'https://linkedin.com', eventos: 123 }, { referrer: 'https://facebook.com', eventos: 80 }, { referrer: 'https://x.com', eventos: 70 }],
    },
    geo: { porPais: [{ country: 'BR', eventos: 7340, visitantes: 2300 }, { country: 'PT', eventos: 1540, visitantes: 700 }, { country: 'US', eventos: 740, visitantes: 250 }, { country: 'AR', eventos: 120, visitantes: 60 }, { country: 'FR', eventos: 34, visitantes: 12 }], porCidade: [{ city: 'São Paulo', region: 'SP', country: 'BR', eventos: 3250 }, { city: 'Rio de Janeiro', region: 'RJ', country: 'BR', eventos: 1760 }, { city: 'Lisboa', region: null, country: 'PT', eventos: 920 }, { city: 'Belo Horizonte', region: 'MG', country: 'BR', eventos: 680 }, { city: 'Curitiba', region: 'PR', country: 'BR', eventos: 200 }], porIsp: [{ isp: 'Vivo', eventos: 3600 }, { isp: 'Claro', eventos: 2500 }, { isp: 'TIM', eventos: 1850 }, { isp: 'Algar Telecom', eventos: 600 }, { isp: 'Outras redes', eventos: 240 }], mapa: [], mapaSuprimido: 27, semGeo: 130 },
    comparacao: { atual: { views, cliques, total: views + cliques, visitantes: 5832 }, anterior: { views: 6400, cliques: 1200, total: 7600, visitantes: 3970 }, porHora: Array.from({ length: 24 }, (_, hora) => ({ hora, atual: 100 + hora * 39 % 800, anterior: 45 + hora * 29 % 600 })), diasAtivos: 30, mediaDiaria: Math.round((views + cliques) / 30) },
    tempoReal: { porMinuto: [], visitas: 0, cliques: 0, total: 0, minutos: 30, fontes: [] },
    titulos: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i), ['Minha coleção favorita', 'Conheça meu trabalho', 'Conteúdos exclusivos', 'Meu kit de viagem', 'Indicações da semana', 'Cupom especial para seguidores', 'Newsletter: histórias e novidades', 'Minha loja de produtos selecionados', 'Vídeos e entrevistas', 'Contato', 'Portfólio'][i]])),
  },
}
const dir = process.env.PDF_QA_DIR || '/tmp/krew-analytics-pdf'
await mkdir(dir, { recursive: true })
await writeFile(`${dir}/relatorio-exemplo.pdf`, await renderToBuffer(RelatorioPdf({ dados })))
const vazio: RelatorioAnalytics = { ...dados, nome: 'Perfil sem visitas', slug: 'novo-perfil', painel: {
  leve: { porDia: [], porBotao: [], porDispositivo: {}, porReferrer: [] },
  geo: { porPais: [], porCidade: [], porIsp: [], mapa: [], mapaSuprimido: 0, semGeo: 0 },
  comparacao: { atual: { views: 0, cliques: 0, total: 0, visitantes: 0 }, anterior: { views: 0, cliques: 0, total: 0, visitantes: 0 }, porHora: Array.from({ length: 24 }, (_, hora) => ({ hora, atual: 0, anterior: 0 })), diasAtivos: 0, mediaDiaria: 0 },
  tempoReal: dados.painel.tempoReal, titulos: {},
} }
await writeFile(`${dir}/relatorio-vazio.pdf`, await renderToBuffer(RelatorioPdf({ dados: vazio })))
console.log(`PDFs de demonstração (dados fictícios): ${dir}`)
