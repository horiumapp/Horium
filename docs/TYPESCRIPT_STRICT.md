# TypeScript strict — estratégia gradual

## Estado atual (`tsconfig.json`)

- `strict` **não** habilitado globalmente
- `strictNullChecks` / `noImplicitAny` ainda off
- `allowJs: true` e `skipLibCheck: true` mantidos

Habilitar `strict` de uma vez gera centenas de erros em UI, serviços e testes legados. A migração é intencional e incremental.

## Escopo atual de `tsconfig.strict.json`

Já incluso sob `strict` / `strictNullChecks` / `noImplicitAny`:

- `services/enginePreflight.ts`
- `services/timetableGenerator.ts`
- `services/generatorAbort.ts`
- `services/scheduleService.ts`
- `utils/scheduleUtils.ts`
- `utils/businessDate.ts`
- `utils/publicError.ts`
- `types.ts`

Validar com: `npx tsc -p tsconfig.strict.json --noEmit`

## Próximos passos (ordem sugerida)

1. Incluir `services/pricingService.ts`, `services/authService.ts` e `utils/pix.ts`.
2. Em seguida o restante de `services/` (exceto o monolito `timetableWorker.ts`).
3. Por último `timetableWorker.ts` e páginas React — maior volume de erros.
4. Só então `strict: true` no `tsconfig.json` principal.

## Regras desta etapa

- Não usar `any` para silenciar erros
- Não desabilitar checagem por arquivo (`// @ts-nocheck`)
- Preferir tipos estreitos e guards
