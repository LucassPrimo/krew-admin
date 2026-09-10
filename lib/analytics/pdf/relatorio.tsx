import React from 'react'
import { Document, Page, Text, View, Svg, Path, Line, Circle, StyleSheet, Link } from '@react-pdf/renderer'
import { MarcaPdf } from './marca'
import mapa from './mapa.json'
import { agruparFontes } from '@/lib/analytics/fontes'
import {
  dataPdf, numeroPdf as n, percentualPdf as pct, variacaoPdf, rankingPdf,
  ROTULOS_PDF, FUSO, type RelatorioAnalytics,
} from './dados'

// Paleta acromática: todos os canais RGB são iguais, inclusive nos gráficos.
const C = { bg: '#000000', card: '#141414', line: '#303030', ink: '#ffffff', muted: '#a8a8a8', accent: '#ffffff', secondary: '#808080' }
const s = StyleSheet.create({
  page: { height: 841.89, backgroundColor: C.bg, color: C.ink, fontFamily: 'Helvetica', fontSize: 10, padding: 38, paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  eyebrow: { color: C.accent, fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  title: { fontSize: 29, fontFamily: 'Helvetica-Bold', letterSpacing: -1, marginBottom: 10 },
  sub: { color: C.muted, fontSize: 10, lineHeight: 1.5, marginBottom: 22 },
  card: { backgroundColor: C.card, borderRadius: 15, padding: 17, marginBottom: 14, borderWidth: 0.6, borderColor: C.line },
  cardTitle: { fontFamily: 'Helvetica-Bold', fontSize: 13, marginBottom: 7 },
  note: { color: C.muted, fontSize: 8, lineHeight: 1.5 },
  row: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, backgroundColor: C.card, borderRadius: 13, padding: 16, borderWidth: 0.6, borderColor: C.line },
  label: { fontSize: 9, color: C.muted, marginBottom: 9 },
  value: { fontSize: 27, fontFamily: 'Helvetica-Bold', letterSpacing: -0.7, marginBottom: 8 },
  delta: { color: C.accent, fontSize: 8 },
  footer: { position: 'absolute', bottom: 26, left: 38, right: 38, paddingTop: 10, borderTopWidth: 0.6, borderTopColor: C.line, flexDirection: 'row', justifyContent: 'space-between', color: C.muted, fontSize: 7 },
})

function Rodape({ dados }: { dados: RelatorioAnalytics }) {
  return <View style={s.footer} fixed>
    <Text style={{ maxWidth: 300 }}>Krew Analytics / @{dados.slug}</Text>
    <Text render={({ pageNumber, totalPages }) => `${dataPdf(dados.ate)}   /   ${String(pageNumber).padStart(2, '0')} - ${String(totalPages).padStart(2, '0')}`} />
  </View>
}

function Folha({ dados, indice, titulo, subtitulo, children }: {
  dados: RelatorioAnalytics; indice: string; titulo: string; subtitulo: string; children: React.ReactNode
}) {
  return <Page size="A4" style={s.page}>
    <View style={s.header}><MarcaPdf largura={82} /><Text style={s.note}>{dataPdf(dados.desde)} - {dataPdf(dados.ate)}</Text></View>
    <Text style={s.eyebrow}>{indice} / RELATÓRIO DE PERFORMANCE</Text>
    <Text style={s.title}>{titulo}</Text><Text style={s.sub}>{subtitulo}</Text>
    {children}<Rodape dados={dados} />
  </Page>
}

function Cartao({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return <View style={s.card}><Text style={s.cardTitle}>{titulo}</Text>{nota && <Text style={[s.note, { marginBottom: 14 }]}>{nota}</Text>}{children}</View>
}

function Metrica({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return <View style={s.metric}><Text style={s.label}>{titulo}</Text><Text style={[s.value, { fontSize: valor.length > 9 ? 20 : 27 }]}>{valor}</Text><Text style={s.delta}>{nota}</Text></View>
}

function Ranking({ linhas, limite = 8, unidade = 'visitas' }: { linhas: { nome: string; valor: number }[]; limite?: number; unidade?: string }) {
  const r = rankingPdf(linhas, limite)
  if (!r.linhas.length) return <View style={{ paddingVertical: 22 }}><Text style={s.note}>Nenhum {unidade === 'cliques' ? 'clique' : 'acesso'} registrado neste recorte.</Text></View>
  return <View>
    {r.linhas.map((l, i) => <View key={i} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <Text style={{ color: C.ink, fontSize: 9, flex: 1, maxLines: 1, textOverflow: 'ellipsis' }}>{l.nome}</Text>
        <Text style={{ color: C.muted, fontSize: 8 }}>{n(l.valor)} / {pct(l.valor, r.total)}</Text>
      </View>
      <View style={{ height: 3, borderRadius: 2, backgroundColor: C.line }}><View style={{ height: 3, borderRadius: 2, width: `${r.total > 0 ? l.valor / r.total * 100 : 0}%`, backgroundColor: C.accent }} /></View>
    </View>)}
    <Text style={[s.note, { marginTop: 2 }]}>{n(r.total)} {unidade} no ranking.{r.restantes > 0 ? ` Exibindo os ${limite} primeiros; ${r.restantes} outros itens não exibidos.` : ''}</Text>
  </View>
}

function Grafico({ serie, altura = 148, anterior = false }: { serie: { a: number; b: number; rotulo: string }[]; altura?: number; anterior?: boolean }) {
  const width = 476, left = 30, right = 6, top = 15, bottom = altura - 24
  const max = Math.max(1, ...serie.flatMap((d) => [d.a, d.b]))
  const x = (i: number) => left + i / Math.max(1, serie.length - 1) * (width - left - right)
  const y = (v: number) => bottom - v / max * (bottom - top)
  const pontos = (chave: 'a' | 'b') => serie.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[chave])}`).join(' ')
  const indices = Array.from(new Set([0, Math.floor((serie.length - 1) / 2), serie.length - 1])).filter((i) => i >= 0 && i < serie.length)
  return <View>
    <Svg width="100%" height={altura} viewBox={`0 0 ${width} ${altura}`}>
      {[0, 0.5, 1].map((f) => <React.Fragment key={f}>
        <Line x1={left} x2={width - right} y1={y(max * f)} y2={y(max * f)} stroke={C.line} strokeWidth={0.5} />
        <Text x={0} y={y(max * f) + 3} style={{ fill: C.muted, fontSize: 7 }}>{n(max * f)}</Text>
      </React.Fragment>)}
      {serie.length > 1 && <Path d={`${pontos('a')} L${x(serie.length - 1)},${bottom} L${left},${bottom} Z`} fill={C.accent} fillOpacity={0.08} />}
      {serie.length > 1 && <Path d={pontos('a')} fill="none" stroke={C.accent} strokeWidth={2} />}
      {serie.length > 1 && <Path d={pontos('b')} fill="none" stroke={anterior ? C.muted : C.secondary} strokeWidth={1.8} />}
      {serie.length === 1 && <><Circle cx={x(0)} cy={y(serie[0].a)} r={3} fill={C.accent} /><Circle cx={x(0)} cy={y(serie[0].b)} r={2} fill={C.secondary} /></>}
      {indices.map((i) => <Text key={i} x={x(i)} y={altura - 5} textAnchor={i === 0 ? 'start' : i === serie.length - 1 ? 'end' : 'middle'} style={{ fill: C.muted, fontSize: 7 }}>{serie[i].rotulo}</Text>)}
    </Svg>
    <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
      <Text style={{ fontSize: 8, color: C.accent }}>{anterior ? 'Período atual' : 'Visitas'}</Text>
      <Text style={{ fontSize: 8, color: anterior ? C.muted : C.secondary }}>{anterior ? 'Período anterior' : 'Cliques'}</Text>
    </View>
  </View>
}

function Mapa({ paises }: { paises: RelatorioAnalytics['painel']['geo']['porPais'] }) {
  const max = Math.max(1, ...paises.map((p) => p.eventos))
  const porPais = new Map(paises.map((p) => [p.country.toUpperCase(), p.eventos]))
  return <Svg viewBox={mapa.viewBox} width="100%" height={226}>
    {mapa.paths.map((p, i) => {
      const eventos = porPais.get(p.pais) ?? 0
      return <Path key={i} d={p.d} fill={eventos ? C.accent : C.line} fillOpacity={eventos ? 0.3 + 0.7 * Math.sqrt(eventos / max) : 1} stroke={C.bg} strokeWidth={0.5} />
    })}
  </Svg>
}

function nomePais(codigo: string) {
  try { return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(codigo.toUpperCase()) || codigo } catch { return codigo || 'Não identificado' }
}
const tipos: Record<string, string> = { link: 'Link', rede: 'Rede social', proposta: 'Proposta de parceria', rodape: 'Rodapé Krew', marca: 'Marca' }
const redes: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', whatsapp: 'WhatsApp', twitter: 'X', linkedin: 'LinkedIn' }

/** Template editorial do painel Krew: texto e gráficos vetoriais, sem screenshots. */
export function RelatorioPdf({ dados }: { dados: RelatorioAnalytics }) {
  const { painel: p } = dados
  const { atual, anterior } = p.comparacao
  const taxa = (v: typeof atual) => v.views > 0 ? v.cliques / v.views * 100 : 0
  const serie = p.leve.porDia.map((d) => ({ a: d.views, b: d.cliques, rotulo: /^\d{4}-\d{2}-\d{2}/.test(d.dia) ? `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}` : d.dia }))
  const links = p.leve.porBotao.map((b) => ({
    nome: b.buttonId ? p.titulos[b.buttonId] || 'Link removido' : redes[b.buttonRef || ''] || b.buttonRef || tipos[b.buttonKind || 'link'] || 'Outro botão',
    valor: b.cliques, tipo: b.buttonKind || 'link',
  }))
  const fontes = agruparFontes(p.leve.porReferrer).map((f) => ({ nome: f.referrer === 'direto' ? 'Acesso direto' : f.referrer, valor: f.eventos }))
  const dispositivo: Record<string, string> = { mobile: 'Celular', desktop: 'Computador', tablet: 'Tablet', desconhecido: 'Não identificado' }
  const gerado = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(dados.ate))
  const duracao = new Date(dados.ate).getTime() - new Date(dados.desde).getTime()
  const inicioAnterior = new Date(new Date(dados.desde).getTime() - duracao).toISOString()
  return <Document title={`Krew Analytics - ${dados.nome}`} author="Krew" subject={`${ROTULOS_PDF[dados.periodo]} de performance da página @${dados.slug}`} creator="Krew Analytics" language="pt-BR">
    <Page size="A4" style={s.page}>
      <View style={s.header}><MarcaPdf largura={130} /><Text style={[s.eyebrow, { marginBottom: 0 }]}>CREATOR REPORT</Text></View>
      <View style={{ marginTop: 63 }}>
        <Text style={s.eyebrow}>SUA PRESENÇA. SEU IMPACTO.</Text>
        <Text style={{ fontSize: 62, fontFamily: 'Helvetica-Bold', letterSpacing: -2.8, lineHeight: 1.04 }}>Cada visita{ '\n' }conta uma{ '\n' }história.</Text>
        <View style={{ width: 52, height: 5, backgroundColor: C.accent, marginTop: 25, marginBottom: 25, borderRadius: 3 }} />
        <Text style={{ fontSize: 21, fontFamily: 'Helvetica-Bold', maxLines: 2, textOverflow: 'ellipsis', marginBottom: 8 }}>{dados.nome}</Text>
        <Link src={`https://bekrew.com/@${encodeURIComponent(dados.slug)}`} style={{ color: C.accent, textDecoration: 'none', fontSize: 12 }}>bekrew.com/@{dados.slug}</Link>
      </View>
      <View style={{ marginTop: 44, padding: 24, backgroundColor: C.card, borderRadius: 18, borderWidth: 0.6, borderColor: C.line }}>
        <Text style={s.eyebrow}>ANALYTICS / {ROTULOS_PDF[dados.periodo]}</Text>
        <Text style={{ fontSize: 15, marginBottom: 13 }}>{dataPdf(dados.desde)} - {dataPdf(dados.ate)}</Text>
        <Text style={s.note}>Um retrato da sua página: performance, cliques e audiência.{ '\n' }Preparado pela Krew em {dataPdf(dados.ate)}, às {gerado} (Brasília).</Text>
      </View>
      <Text style={{ marginTop: 24, fontSize: 9, color: C.muted }}>RELATÓRIO DE PERFORMANCE DA PÁGINA</Text>
      <Rodape dados={dados} />
    </Page>

    <Folha dados={dados} indice="01" titulo="Sua performance, de perto." subtitulo="As métricas do seu Analytics, reunidas para acompanhar o impacto da sua página.">
      <View style={[s.card, { padding: 23 }]}>
        <Text style={s.eyebrow}>ACESSOS AO PERFIL</Text>
        <Text style={{ fontSize: 54, fontFamily: 'Helvetica-Bold', letterSpacing: -2 }}>{n(atual.views)}</Text>
        <Text style={[s.delta, { marginTop: 7 }]}>{variacaoPdf(atual.views, anterior.views)}</Text>
      </View>
      <View style={[s.row, { marginBottom: 14 }]}>
        <Metrica titulo="Cliques" valor={n(atual.cliques)} nota={variacaoPdf(atual.cliques, anterior.cliques)} />
        <Metrica titulo="Interações" valor={n(atual.total)} nota={variacaoPdf(atual.total, anterior.total)} />
        <Metrica titulo="Engajamento" valor={`${n(taxa(atual))}%`} nota="Cliques por visita" />
      </View>
      <Cartao titulo="Visão de tráfego" nota="Visitas e cliques ao longo do período selecionado."><Grafico serie={serie} altura={162} /></Cartao>
      <Text style={s.note}>{n(atual.visitantes)} visitantes únicos no período. Interações = visitas + cliques. Uma visita pode gerar vários cliques; por isso, o engajamento pode superar 100%.</Text>
      {atual.total === 0 && <Text style={[s.note, { marginTop: 8 }]}>Ainda não há eventos registrados neste período. As próximas visitas aparecerão nos seus Analytics.</Text>}
    </Folha>

    <Folha dados={dados} indice="02" titulo="Onde o interesse vira clique." subtitulo="Os destinos escolhidos por quem passou pela sua página.">
      <Cartao titulo="Links mais clicados" nota="Participação dentro dos cliques em links. Até 8 destinos por ranking.">
        <Ranking linhas={links.filter((l) => l.tipo === 'link')} unidade="cliques" />
      </Cartao>
      <Cartao titulo="Redes, marcas e outros destinos" nota="Participação dentro dos cliques nos demais botões da página.">
        <Ranking linhas={links.filter((l) => l.tipo !== 'link')} limite={5} unidade="cliques" />
      </Cartao>
      <Text style={s.note}>Links removidos continuam no histórico. Os percentuais usam o total de cada ranking, incluindo itens que não aparecem entre os primeiros.</Text>
    </Folha>

    <Folha dados={dados} indice="03" titulo="Os caminhos da sua audiência." subtitulo="Entenda de onde vieram as visitas e em quais dispositivos elas aconteceram.">
      <Cartao titulo="Fontes de tráfego" nota="Origens agrupadas por plataforma. Acesso direto inclui navegações sem origem informada.">
        <Ranking linhas={fontes} limite={7} />
      </Cartao>
      <View style={s.row}>
        <View style={{ flex: 1 }}><Cartao titulo="Dispositivos" nota="Visitas por tipo de aparelho.">
          <Ranking linhas={Object.entries(p.leve.porDispositivo).map(([nome, valor]) => ({ nome: dispositivo[nome] || nome, valor }))} limite={4} />
        </Cartao></View>
        <View style={{ flex: 1 }}><Cartao titulo="Operadoras" nota="Redes de acesso identificadas.">
          <Ranking linhas={p.geo.porIsp.map((l) => ({ nome: l.isp, valor: l.eventos }))} limite={4} />
        </Cartao></View>
      </View>
      <Text style={s.note}>Fontes e dispositivos contam visitas à página. Uma mesma pessoa pode visitar mais de uma vez.</Text>
    </Folha>

    <Folha dados={dados} indice="04" titulo="Sua presença no mapa." subtitulo="A distribuição geográfica das visitas à sua página, por país e cidade.">
      <Cartao titulo="Audiência pelo mundo" nota="Quanto mais claro o país, maior o volume de visitas identificado.">
        <Mapa paises={p.geo.porPais} />
        <Text style={[s.note, { fontSize: 6, marginTop: 5 }]}>Mapa: Al MacDonald / Fritz Lekschas, simple-world-map, CC BY-SA 3.0. Países sem visitas identificadas aparecem em cinza.</Text>
      </Cartao>
      <View style={s.row}>
        <View style={{ flex: 1 }}><Cartao titulo="Principais países"><Ranking linhas={p.geo.porPais.map((l) => ({ nome: nomePais(l.country), valor: l.eventos }))} limite={4} /></Cartao></View>
        <View style={{ flex: 1 }}><Cartao titulo="Principais cidades"><Ranking linhas={p.geo.porCidade.map((l) => ({ nome: [l.city, l.region].filter(Boolean).join(', '), valor: l.eventos }))} limite={4} /></Cartao></View>
      </View>
      <Text style={s.note}>Localização aproximada. {n(p.geo.semGeo)} visitas sem geolocalização. Cidades com menos de 3 visitantes distintos são protegidas; {n(p.geo.mapaSuprimido)} visitas foram suprimidas do recorte por cidade. Países usam a base disponível completa.</Text>
    </Folha>

    <Folha dados={dados} indice="05" titulo="O ritmo da sua presença." subtitulo={`Comparação com ${dataPdf(inicioAnterior)} - ${dataPdf(dados.desde)}, uma janela anterior de mesma duração.`}>
      <View style={[s.row, { marginBottom: 14 }]}>
        <Metrica titulo="Dias com atividade" valor={n(p.comparacao.diasAtivos)} nota="No período selecionado" />
        <Metrica titulo="Média diária" valor={n(p.comparacao.mediaDiaria)} nota="Interações por dia ativo" />
      </View>
      <Cartao titulo="Padrão de atividade por hora" nota="Interações somadas por hora do dia. Horário de Brasília.">
        <Grafico serie={p.comparacao.porHora.map((d) => ({ a: d.atual, b: d.anterior, rotulo: `${String(d.hora).padStart(2, '0')}h` }))} anterior altura={128} />
      </Cartao>
      <Cartao titulo="Período atual x anterior">
        <View style={{ flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: C.line }}><Text style={{ flex: 1, color: C.muted }}>Métrica</Text><Text style={{ width: 100, textAlign: 'right', color: C.muted }}>Atual</Text><Text style={{ width: 100, textAlign: 'right', color: C.muted }}>Anterior</Text></View>
        {([['Visitas', atual.views, anterior.views], ['Cliques', atual.cliques, anterior.cliques], ['Interações', atual.total, anterior.total], ['Visitantes únicos', atual.visitantes, anterior.visitantes]] as const).map(([label, a, b]) => <View key={label} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: C.line }}><Text style={{ flex: 1 }}>{label}</Text><Text style={{ width: 100, textAlign: 'right' }}>{n(a)}</Text><Text style={{ width: 100, textAlign: 'right', color: C.muted }}>{n(b)}</Text></View>)}
      </Cartao>
      <Text style={s.note}>Sobre este relatório: dados próprios da página Krew, registrados até {gerado} de {dataPdf(dados.ate)} (Brasília). Visitantes únicos são identificadores anônimos, não uma contagem verificada de pessoas. Eventos ainda em processamento podem aparecer depois. Este arquivo é um retrato do período; o painel ao vivo continua se atualizando.</Text>
    </Folha>
  </Document>
}
