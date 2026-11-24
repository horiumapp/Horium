# Horium — Sistema de Gestão de Horário Escolar

Aplicação web para montar, gerar e gerenciar grades escolares com restrições pedagógicas, licenciamento e painel administrativo.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- Supabase (Auth, Postgres, Storage, RLS/RPC)
- Vitest (testes)
- Deploy típico: Vercel

## Pré-requisitos

- Node.js 22+
- Projeto Supabase com as migrations aplicadas

## Instalação local

```bash
npm ci
cp .env.example .env.local
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sim | Chave **anon** (pública). Nunca use `service_role` no frontend. |
| `VITE_PIX_KEY` | Não | Chave PIX exibida na tela de planos |
| `SUPABASE_DB_URL` | Não | Só para `scripts/backup-database.ps1` (sessão do terminal) |

Veja `.env.example` para comentários.

## Scripts

```bash
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção
npm run preview   # preview do build
npm test          # Vitest (unitário)
npx tsc --noEmit  # typecheck
```

## Arquitetura (visão geral)

```
App.tsx                 # sessão, autosave, roteamento por view
pages/                  # Login, Dashboard, Wizard, Planos, Admin
components/wizard/      # passos do assistente de grade
components/result/      # visualização / exportação
services/
  timetableWorker.ts    # motor de geração (Web Worker)
  timetableGenerator.ts # orquestra worker + cancelamento
  scheduleService.ts    # persistência + paywall client
  authService.ts / adminLicenseService.ts / pricingService.ts
db/migrations/          # SQL incremental (fonte da verdade em produção)
schema.sql              # fotografia completa do schema (não reaplicar inteiro)
utils/businessDate.ts   # datas civis em America/Sao_Paulo
```

### Fluxo de geração

1. O usuário configura instituição, semana, disciplinas, turmas, professores e opções.
2. `generateTimetable` sobe um Web Worker (`timetableWorker.ts`).
3. O motor respeita disponibilidade, bloqueios ND, aulas fixas, limites diários e agrupamento.
4. Falhas retornam `SchedulingFailure` com motivo e sugestões quando há dados suficientes.
5. A solução (`fixedLessons`) é isolada em `schedule_solutions` e só é lida via RPC `get_schedule_solution` com licença válida.

### Licenciamento e pagamentos

- Preço calculado **no servidor** (`request_license_order`): R$ 15 / 25 / 50 por turma (6 meses / 1 ano / 2 anos).
- Comprovante sobe para bucket privado `receipts`; admin aprova manualmente (`approve_license_rpc`).
- Validade usa o dia civil de Brasília (`business_today()` / `utils/businessDate.ts`).
- Integração futura com gateway/webhook pode reutilizar as mesmas RPCs sem mudar o paywall.

## Banco de dados e migrations

Em produção, aplique **apenas** o próximo arquivo em `db/migrations/`, na ordem:

1. `0001_profiles_rls_and_license_notices.sql`
2. `0002_admin_identity_and_audit_immutability.sql`
3. `0003_close_open_policies_and_migration_ledger.sql`
4. `0004_audit_payload_license_revocation.sql`
5. `0005_security_hardening.sql` ← bypass anônimo, grants, escopo de licença, storage DELETE
6. `0006_schedules_version_occ.sql` ← coluna `schedules.version` para OCC / auto-save

**Não** rode `schema.sql` inteiro de novo em um banco já existente.

Após aplicar as migrations, confirme no SQL Editor:

```sql
SELECT version FROM public.schema_migrations ORDER BY version;
```

## Segurança (resumo)

- RLS em todas as tabelas sensíveis
- Admin via `admin_users.user_id` + `is_admin()` (SECURITY DEFINER + `search_path` fixo)
- Paywall server-side em `get_schedule_solution`
- Storage privado com pastas por `auth.uid()`
- Uploads: extensão, MIME e magic bytes
- CSP / HSTS em `vercel.json`

## Testes e CI

O workflow `.github/workflows/ci.yml` executa:

1. `npm ci`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run build`

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| “Acesso negado” ao ver grade | Sem licença aprovada ou migration 0005 não aplicada | Conferir `licenses` e RPCs |
| Expiração “um dia antes” | Data em UTC no frontend antigo | Usar `businessToday()` / aplicar 0004+ |
| Worker timeout | Restrições impossíveis / grade grande | Simplificar ND/aulas fixas; ver diagnósticos |
| Upload de comprovante falha | MIME/magic inválido ou >5 MB | PNG/JPG/WEBP/PDF reais |
| Auto-save falha (400 em `version=eq.…`) | Coluna `schedules.version` ausente | Aplicar `0006_schedules_version_occ.sql` |
| Auto-save falha | Rede ou tabela `audit_logs` | Rascunho fica em `localStorage` (`horium_draft_*`) |
| CSP bloqueia script / tema | Script inline sem hash atualizado | Usar `/theme-init.js` (sem inline) |

## Documentação adicional

- `docs/security-audit/` — material histórico de auditoria (tratar como confidencial)
- `scripts/backup-database.ps1` — dump pontual do Postgres

## Licença do projeto

Privado / uso conforme o repositório da organização Horium.
