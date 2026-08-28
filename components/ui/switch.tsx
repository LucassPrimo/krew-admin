"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/**
 * O app nunca teve switch — booleano virava `Select` de duas opções (ver
 * `components/perfil/notifications-toggle.tsx`, que argumenta bem o caso:
 * notificação é estado, e um select deixa o estado explícito).
 *
 * A configuração da bio é o caso oposto: uma pilha de liga/desliga onde o que
 * importa é varrer a lista e ver o que está ligado. Select em fila faria o
 * usuário ler seis rótulos para saber o que está ativo.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill border border-transparent p-0.5 transition-colors outline-none",
        "bg-border-strong data-checked:bg-primary",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "block size-5 rounded-pill bg-white shadow-sm transition-transform",
          "data-unchecked:translate-x-0 data-checked:translate-x-5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
