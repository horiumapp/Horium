# TypeScript strict — estratégia gradual

## Estado atual (`tsconfig.json`)

- `strict` **não** habilitado globalmente
- `strictNullChecks` / `noImplicitAny` ainda off
- `allowJs: true` e `skipLibCheck: true` mantidos

Habilitar `strict` de uma vez gera centenas de erros em UI, serviços e testes legados. A migração é intencional e incremental.

## Próximos passos (ordem sugerida)

1. Rodar `npx tsc -p tsconfig.strict.json --noEmit` e triar erros por pasta.
2. Habilitar só `noImplicitAny` nos módulos novos/alterados (`services/enginePreflight.ts`, cancelamento, `scheduleService`).
3. Em seguida `strictNullChecks` em `services/` e `utils/`.
4. Só então `strict: true` no `tsconfig.json` principal.

## Regras desta etapa

- Não usar `any` para silenciar erros
- Não desabilitar checagem por arquivo (`// @ts-nocheck`)
- Preferir tipos estreitos e guards
