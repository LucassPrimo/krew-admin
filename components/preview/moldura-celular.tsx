import { cn } from '@/lib/utils'

/**
 * A moldura de celular das prévias — a imagem de um aparelho de verdade
 * (`/public/phone-frame.png`), não mais uma borda arredondada desenhada em
 * CSS.
 *
 * O PNG tem o INTERIOR TRANSPARENTE, e é isso que faz o desenho funcionar: a
 * prévia fica por baixo e a imagem por cima, com `pointer-events-none`. A
 * ilha dinâmica e os cantos arredondados são pixels opacos da própria imagem,
 * então eles cobrem o conteúdo como cobririam num aparelho — e a prévia não
 * precisa de `border-radius` nenhum, porque o canto quadrado dela cai debaixo
 * da moldura preta.
 *
 * Os quatro números abaixo são a tela medida na imagem (1125×2300):
 * x 61→1064, y 57→2243. Em PORCENTAGEM, e não em pixels, porque a moldura
 * muda de tamanho conforme a altura disponível — a busca a estica até a tela
 * inteira, o painel de aparência a fixa. A proporção da imagem faz o resto.
 */
const TELA = {
  left: '5.4222%',
  top: '2.4783%',
  width: '89.1556%',
  height: '95.0435%',
  /**
   * O canto arredondado da tela, e não da moldura.
   *
   * A moldura preta é opaca e cobriria um canto quadrado — mas só até onde ela
   * passa: nos quatro cantos a curva do vidro é mais fechada que a da imagem, e
   * a quina do conteúdo aparecia POR FORA dela, quatro pontinhas de cor
   * furando o aparelho.
   *
   * 165px de raio na imagem de 1125×2300 — o valor AJUSTADO à curva medida, e
   * não um arredondamento generoso. A borda do vidro na imagem passa por
   * (dy 80, x+21), (dy 120, x+6) e (dy 165, x+0), que é o que um raio de 165
   * descreve; com os ~190 que estavam aqui antes, o corte comia um pedaço da
   * imagem para dentro da tela e aparecia como quina clara no topo.
   *
   * Escrito como `x / y` porque uma porcentagem única em `border-radius` mede
   * a largura na horizontal e a ALTURA na vertical — num retângulo 1:2 isso
   * daria uma elipse deitada. Dois eixos separados (16,5% de 1003 ≈ 7,55% de
   * 2186) mantêm o canto redondo em qualquer tamanho da moldura.
   *
   * Ficar por dentro da curva real é seguro: o canto do aparelho é um
   * squircle, que passa POR FORA do círculo de mesmo raio perto da diagonal —
   * o que sobra fica debaixo do preto opaco da moldura.
   */
  borderRadius: '14.5% / 7.55%',
} as const

/**
 * A altura manda, a largura é consequência.
 *
 * A moldura vive em colunas onde o que falta é altura (a da busca ocupa a
 * janela inteira). Declarar `aspect-ratio` e deixar a altura vir do pai é o
 * que permite a mesma peça encolher com a janela sem que ninguém recalcule
 * larguras — e a tela de dentro acompanha, porque é medida em porcentagem.
 *
 * Sem `transform: scale`: o iframe é redimensionado de verdade, então o texto
 * dentro dele continua nítido e a página cai no layout de celular pela
 * largura real, que é o que a prévia existe para mostrar.
 */
export function MolduraCelular({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('relative h-full w-auto shrink-0', className)}
      style={{ aspectRatio: '1125 / 2300' }}
    >
      {/* O brilho por trás do aparelho — luz vazando um pouco para o lado, não
          uma sombra retangular colada nele.
          `drop-shadow` no PNG fazia isso antes, e é o que causava o halo
          QUADRADO: o filtro do navegador reserva uma região de desfoque do
          tamanho da IMAGEM inteira (1125×2300), e num blur grande essa região
          vira visível como uma caixa — a sombra não segue o contorno do
          aparelho, segue o retângulo do arquivo.
          Este blob resolve com uma camada própria: um gradiente radial,
          borrado, ATRÁS da imagem (antes dela no DOM) e deslocado para a
          direita — a luz "escapa" de um lado, como numa vitrine, em vez de
          se espalhar simetricamente embaixo.
          `-z-10` e não `overflow-hidden` no wrapper: o blur precisa sangrar
          para fora dos limites do retângulo do celular para não ter borda
          visível — um `overflow-hidden` aqui recriaria o mesmo corte que este
          blob existe para evitar. */}
      <div
        aria-hidden
        // `--mint`, e não `--primary`: `--primary` inverte de preto (claro)
        // para verde (escuro) entre os temas, e um blob preto a 25% de
        // opacidade não lê como luz — lê como mancha cinza. `--mint` é a
        // MESMA cor nos dois temas, a mesma que já pinta o botão de IA
        // flutuante do dashboard.
        className="pointer-events-none absolute inset-[6%] -z-10 rounded-[40%] blur-[80px]"
        style={{ backgroundColor: 'rgba(10,154,125,0.28)', transform: 'translateX(18%)' }}
      />

      <div className="absolute overflow-hidden bg-background" style={TELA}>
        {children}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/phone-frame.png"
        alt=""
        aria-hidden
        // `pointer-events-none` é requisito, não polimento: a imagem cobre a
        // tela inteira e sem isto nenhum clique chegaria na prévia embaixo.
        //
        // Sombra própria pequena, e não mais o `drop-shadow` grande (ver o
        // comentário do blob acima) — só o suficiente para descolar o
        // aparelho do fundo, sem reintroduzir a caixa.
        className="pointer-events-none absolute inset-0 h-full w-full select-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.18)]"
      />
    </div>
  )
}
