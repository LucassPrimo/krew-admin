import { FUNIL, ROTULO, type Estagio } from '@/lib/crm-tipos'

/**
 * O estágio como pílula com um ponto.
 *
 * Num painel monocromático um `Badge` por estágio não diz ordem: sete pílulas
 * iguais obrigam a LER as sete para saber qual está na frente. O ponto resolve
 * isso sem trazer cor — ele clareia conforme o lead avança, então a coluna
 * inteira se lê de relance, e quem não distingue tom nenhum continua tendo o
 * texto.
 *
 * As duas exceções são as que mudam o que fazer: `aceito` fecha em branco
 * pleno, `perdido` é a única coisa vermelha da tela. Ver o comentário das
 * cores em `globals.css` — sinal em cinza no meio do cinza deixa de ser sinal.
 */
export function Etapa({ estagio }: { estagio: Estagio }) {
  const posicao = FUNIL.indexOf(estagio)

  if (estagio === 'perdido') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-perigo/40 px-2 py-0.5 text-[11px] text-perigo">
        <span className="size-1.5 rounded-full bg-perigo" />
        {ROTULO.perdido}
      </span>
    )
  }

  const ultimo = posicao === FUNIL.length - 1

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${
        ultimo ? 'border-acento/50 text-texto' : 'border-borda-forte text-texto-fraco'
      }`}
    >
      <span
        className="size-1.5 rounded-full bg-acento"
        // Do 25% ao branco pleno ao longo das seis etapas. Em `style` e não em
        // classe porque Tailwind só emite as opacidades que vê escritas —
        // `bg-acento/${n}` calculado em tempo de execução não existiria no CSS.
        style={{ opacity: 0.25 + (posicao / (FUNIL.length - 1)) * 0.75 }}
      />
      {ROTULO[estagio]}
    </span>
  )
}
