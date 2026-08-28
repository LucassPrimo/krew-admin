/**
 * A moldura de celular da prévia — a mesma peça do krew-app.
 *
 * O PNG tem o INTERIOR TRANSPARENTE: a prévia fica por baixo e a imagem por
 * cima, com `pointer-events-none`. A ilha dinâmica e os cantos são pixels
 * opacos da própria imagem, então cobrem o conteúdo como cobririam num
 * aparelho — e o iframe não precisa de canto arredondado nenhum.
 *
 * Os números são a tela medida na imagem (1125×2300), em PORCENTAGEM e não em
 * pixels, porque a moldura muda de tamanho conforme a altura disponível.
 */
const TELA = {
  left: '5.4222%',
  top: '2.4783%',
  width: '89.1556%',
  height: '95.0435%',
  // Dois eixos separados: uma porcentagem única em `border-radius` mede
  // largura na horizontal e ALTURA na vertical, o que num retângulo 1:2 daria
  // uma elipse deitada.
  borderRadius: '14.5% / 7.55%',
} as const

export function MolduraCelular({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    // A altura manda e a largura é consequência: `aspect-ratio` deixa a mesma
    // peça encolher com a janela sem ninguém recalcular largura, e a tela de
    // dentro acompanha porque é medida em porcentagem.
    <div className={`relative aspect-[1125/2300] ${className}`}>
      <div className="absolute overflow-hidden" style={TELA}>
        {children}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/phone-frame.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      />
    </div>
  )
}
