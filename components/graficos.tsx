'use client'

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

/**
 * Gráficos do painel. Recharts, como no krew-app.
 *
 * Um só componente de barras porque é a forma que responde quase tudo que se
 * pergunta aqui: "quanto, por dia" e "quanto, por categoria". Linha e área
 * entram quando existir uma pergunta que barras não respondam — não antes.
 */
export function Barras({
  dados, altura = 180,
}: { dados: { rotulo: string; valor: number }[]; altura?: number }) {
  if (dados.length === 0) {
    return <p className="py-8 text-center text-sm text-texto-fraco">Sem dados no período.</p>
  }

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#232b27" vertical={false} />
          <XAxis
            dataKey="rotulo" tick={{ fill: '#98a29c', fontSize: 10 }}
            axisLine={false} tickLine={false}
            // Trinta rótulos de data não cabem: mostrar um a cada cinco mantém
            // a referência temporal sem virar borrão.
            interval={Math.max(Math.floor(dados.length / 6), 0)}
          />
          <YAxis
            tick={{ fill: '#98a29c', fontSize: 10 }} axisLine={false} tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: '#17251f' }}
            contentStyle={{
              background: '#101312', border: '1px solid #232b27',
              borderRadius: 8, fontSize: 12, color: '#eef0ee',
            }}
            labelStyle={{ color: '#98a29c' }}
          />
          {/* A cor vem do token, não de um hex solto: assim a barra acompanha
              qualquer mudança de acento em vez de virar a única coisa da tela
              ainda pintada da cor antiga — que foi exatamente o que aconteceu
              quando o painel trocou de âmbar para o mint da marca. */}
          <Bar dataKey="valor" fill="var(--color-acento)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
