/**
 * Fim de linha para quem passou pelo login mas não é administrador.
 *
 * Sem detalhe nenhum sobre o que faltou: dizer "seu id não está na lista" ou
 * "você não está em platform_admins" ensina qual das duas camadas atacar.
 */
export default function Negado() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="mb-2 text-xl font-medium">Sem permissão</h1>
        <p className="text-sm text-texto-fraco">
          Esta conta não tem acesso ao painel interno.
        </p>
      </div>
    </main>
  )
}
