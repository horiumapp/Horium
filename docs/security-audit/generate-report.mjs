/**
 * Gerador de Relatório de Auditoria de Segurança — Horium
 * Dependência: pdfkit (npm install pdfkit)
 * Execução: node generate-report.mjs
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── PALETA DE CORES EXIGIDA ──────────────────────────────────
const SEV = {
  critica:      { color: '#B91C1C', label: 'Crítica', bg: '#FEE2E2', border: '#F87171' },
  alta:         { color: '#EA580C', label: 'Alta', bg: '#FFEDD5', border: '#FB923C' },
  media:        { color: '#D97706', label: 'Média', bg: '#FEF3C7', border: '#FBBF24' },
  baixa:        { color: '#2563EB', label: 'Baixa', bg: '#DBEAFE', border: '#60A5FA' },
  informativa:  { color: '#6B7280', label: 'Informativa', bg: '#F3F4F6', border: '#9CA3AF' },
  ponto_forte:  { color: '#059669', label: 'Ponto Forte', bg: '#D1FAE5', border: '#34D399' },
};

const MARGIN = 54; // ~1.9 cm
const PAGE_W = 595.28; // Formato A4
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// ─── METADADOS DA AUDITORIA ────────────────────────────────────
const PROJECT_NAME = 'Horium';
const AUDIT_DATE = '07 de Setembro de 2026';

// ─── ACHADOS CONFIRMADOS ───────────────────────────────────────
const findings = [
  {
    id: 'F01',
    category: '2. Autorização no Navegador',
    severity: 'critica',
    title: 'Bypass de Paywall e Licenciamento: Exposição da Solução Completa da Grade no SELECT de Schedules com Ocultação Apenas em Memória do Cliente',
    file: 'schema.sql:87-88 / services/scheduleService.ts',
    lines: 'schema.sql:87-88 / scheduleService.ts:77-81, 126-130',
    snippet: `// services/scheduleService.ts:126-130
const safeData = isApproved ? normalizedData : {
    ...normalizedData,
    fixedLessons: []
};`,
    flow: 'Usuário gera horário no assistente -> Dados salvos no banco com fixedLessons completo na coluna schedules.data -> RLS de SELECT em schedules permite leitura do registro ao dono (auth.uid() = user_id) sem validar is_licensed -> PostgREST entrega todo o payload JSONB via HTTP -> Cliente JavaScript mascara fixedLessons: [] apenas na memória do browser.',
    why: 'A autorização de acesso ao produto comercial gerado (paywall de fixedLessons) é imposta apenas no frontend. A política RLS da tabela schedules entrega o campo data completo para qualquer consulta SELECT * autenticada pelo proprietário, permitindo obter a grade inteira via DevTools ou console sem pagar.',
    exploitability: 'Qualquer usuário cadastrado com plano gratuito ou grade não licenciada. Basta inspecionar a resposta HTTP na aba Network ou executar supabase.from(\'schedules\').select(\'data\') no console do navegador.',
    preconditions: 'Possuir conta cadastrada e ter processado a geração de uma grade no assistente.',
    impact: 'Evasão completa do modelo comercial do software. Qualquer usuário obtém o resultado da otimização escolar gratuitamente.',
    controlsConsidered: 'A RPC get_schedule_solution existe no banco com validação de pagamento, mas é inócua porque o SELECT * direto na tabela schedules já retorna a solução completa.',
    recommendation: 'Separar fixedLessons em tabela/coluna restrita ou criar VIEW com RLS que oculte data->\'fixedLessons\' para grades sem licença ativa.',
    prio: 'P1'
  },
  {
    id: 'F02',
    category: '1. Isolamento de Dados / Cross-Tenant',
    severity: 'alta',
    title: 'Ausência de Isolamento Multi-Tenant na Tabela audit_logs Devido à Política RLS Permissiva USING (true)',
    file: 'schema.sql',
    lines: '233-235',
    snippet: `DROP POLICY IF EXISTS "Permitir acesso audit_logs" ON public.audit_logs;
CREATE POLICY "Permitir acesso audit_logs" 
ON public.audit_logs FOR ALL TO authenticated 
USING (true) WITH CHECK (true);`,
    flow: 'Usuário autentica no Supabase -> Envia query PostgREST direta para /rest/v1/audit_logs -> PostgreSQL avalia política RLS -> USING (true) WITH CHECK (true) permite SELECT, INSERT, UPDATE e DELETE irrestritos.',
    why: 'A tabela audit_logs registra histórico de operações, dados anteriores (old_data) e novos (new_data). A política FOR ALL TO authenticated USING (true) remove qualquer barreira de tenant, permitindo a qualquer usuário ler dados de auditoria de outros clientes e forjar ou apagar registros.',
    exploitability: 'Qualquer usuário autenticado via cliente PostgREST/Supabase pode ler, modificar ou deletar logs de qualquer outro usuário ou organização.',
    preconditions: 'Nenhuma além de possuir conta registrada no sistema.',
    impact: 'Vazamento massivo de dados sensíveis entre tenants (cross-tenant data leakage), adulteração maliciosa de registros de auditoria e destruição de trilhas de auditoria.',
    controlsConsidered: 'RLS está habilitado na tabela, mas a política configurada explicitamente usa true como predicado universal.',
    recommendation: 'Restringir a política para USING (auth.uid() = user_id OR public.is_admin()) ou restringir acesso exclusivamente ao service_role e admins.',
    prio: 'P1'
  },
  {
    id: 'F03',
    category: '5. Inputs sem Tratamento / XSS',
    severity: 'alta',
    title: 'Stored XSS e Injeção de URI JavaScript no Painel do Administrador via URL de Comprovante de Pagamento (receipt_url)',
    file: 'pages/AdminPanelPage.tsx / schema.sql',
    lines: 'AdminPanelPage.tsx:87-109, 338, 351-356 / schema.sql:113-125',
    snippet: `// AdminPanelPage.tsx:108
setViewingReceiptUrl(urlOrPath); // Fallback recebe string crua do usuário
// AdminPanelPage.tsx:351-353
{viewingReceiptUrl.endsWith('.pdf') ? (
    <iframe src={viewingReceiptUrl} title="Comprovante PDF" ... />
) : ...}`,
    flow: 'Usuário envia pedido de licença com receipt_url malicioso (ex: javascript:alert(document.domain)//.pdf) -> schema.sql grava sem sanitização -> Admin abre AdminPanelPage e clica para ver comprovante -> createSignedUrl falha no Storage -> Fallback armazena URL crua no estado -> Componente renderiza <iframe src={viewingReceiptUrl}> e <a href={viewingReceiptUrl}>.',
    why: 'O valor de receipt_url é controlado pelo usuário e não é validado nem no banco nem no frontend. O sufixo //.pdf satisfaz a verificação .endsWith(\'.pdf\'), levando o navegador a renderizar um iframe com src javascript:, executando código malicioso sob a origem do admin.',
    exploitability: 'Qualquer usuário comum pode enviar uma licença com payload de URI JavaScript. Quando o administrador visualiza o comprovante para análise, o exploit executa automaticamente.',
    preconditions: 'Administrador abrir a visualização de comprovante da licença enviada.',
    impact: 'Execução de JavaScript com privilégios de Administrador (Stored XSS). Permite roubo de tokens JWT de autenticação do localStorage e execução não autorizada de aprovações/exclusões de licenças.',
    controlsConsidered: 'createSignedUrl tenta buscar arquivo no bucket, mas o bloco de fallback repassa o valor cru diretamente ao DOM sem validar protocolo.',
    recommendation: 'Validar estritamente que receipt_url inicia com padrão de caminho interno ou URL HTTPS válida. Rejeitar esquemas javascript: e data:. Não renderizar iframes com URLs externas arbitrárias.',
    prio: 'P1'
  },
  {
    id: 'F04',
    category: '2. Autorização no Navegador',
    severity: 'alta',
    title: 'Bypass do Cálculo Seguro de Preços por Meio de Fallback de Inserção Direta na Tabela licenses',
    file: 'pages/PlansPage.tsx / schema.sql',
    lines: 'PlansPage.tsx:127-147 / schema.sql:151-161',
    snippet: `// pages/PlansPage.tsx:130-139
const { error: insertError } = await supabase.from('licenses').insert({
    user_id: userData.user.id,
    classes_amount: numClasses,
    value_paid: totalPrice, // valor calculado no client-side
    payment_status: 'Aguardando',
    receipt_url: filePath,
});`,
    flow: 'Frontend implementa fallback de inserção direta na tabela licenses se a RPC request_license_order falhar -> Política RLS de INSERT em licenses permite inserção por usuários comuns autenticados com payment_status em Aguardando -> Atacante ignora a RPC e faz POST /rest/v1/licenses enviando classes_amount: 100 e value_paid: 0.01 -> O banco aceita porque a constraint só exige value_paid > 0.',
    why: 'A regra de negócio que calcula o valor oficial por turma está implementada na RPC request_license_order, mas a tabela licenses continua aberta para INSERT direto com preço e turmas arbitrários.',
    exploitability: 'Qualquer usuário autenticado pode emitir chamada direta ao PostgREST e criar pedidos de licença de qualquer quantidade de turmas pagando valores irrisórios.',
    preconditions: 'Estar autenticado.',
    impact: 'Adulteração de faturamento, pedidos fraudulentos exibidos na fila de conciliação do administrador.',
    controlsConsidered: 'A constraint chk_licenses_positive_values exige value_paid > 0, mas aceita qualquer quantia positiva (como R$ 0,01).',
    recommendation: 'Revogar permissão de INSERT direto em licenses para o papel authenticated, permitindo inserção exclusivamente através da RPC request_license_order.',
    prio: 'P2'
  },
  {
    id: 'F05',
    category: '4. Secrets e Credenciais',
    severity: 'media',
    title: 'Hardcoding de E-mails de Administradores Mestre no Código-Fonte e na Função SQL is_admin()',
    file: 'schema.sql / components/Layout.tsx',
    lines: 'schema.sql:29, 36, 40 / Layout.tsx:72',
    snippet: `// schema.sql:29
OR (v_user_email IN ('horium.app@gmail.com', 'prof.jackison@gmail.com'));
// components/Layout.tsx:72
const isMasterAdmin = ['horium.app@gmail.com', 'prof.jackison@gmail.com'].includes(userEmailLower);`,
    flow: 'E-mails de administradores mestres fixados como literais string em schema.sql e em Layout.tsx -> Bundle JavaScript gerado pelo Vite contém os e-mails em texto claro -> Função is_admin() no PostgreSQL concede poderes totais por correspondência estática de string.',
    why: 'Embora a tabela dinâmica admin_users tenha sido criada, a checagem de privilégios mantém fallback fixo para e-mails hardcoded, expondo os administradores publicamente no bundle.',
    exploitability: 'Qualquer visitante pode extrair os e-mails administrativos do bundle frontend para lançar ataques de spear phishing ou força bruta.',
    preconditions: 'Acesso público ao bundle JavaScript.',
    impact: 'Exposição de identidade administrativa e inflexibilidade no ciclo de vida de privilégios.',
    controlsConsidered: 'A verificação de admin no banco consulta admin_users, mas a cláusula OR com e-mails estáticos anula o isolamento.',
    recommendation: 'Remover e-mails hardcoded de schema.sql e Layout.tsx. Delegar autenticação de papéis exclusivamente à tabela admin_users e RPC is_current_user_admin().',
    prio: 'P2'
  },
  {
    id: 'F06',
    category: '4. Secrets e Credenciais',
    severity: 'baixa',
    title: 'Regra Incompleta de Exclusão de Ambientes no .gitignore Expondo Potenciais Arquivos .env',
    file: '.gitignore',
    lines: '13',
    snippet: `*.local`,
    flow: 'O arquivo .gitignore ignora apenas o padrão *.local (cobrindo .env.local) -> Caso um desenvolvedor crie .env ou .env.production com credenciais sensíveis (ex: service_role), o Git não os ignorará automaticamente.',
    why: 'O padrão .env e suas variações não estão declarados nas regras de ignore do repositório.',
    exploitability: 'Risco operacional em desenvolvimento ou automação CI.',
    preconditions: 'Criação inadvertida de arquivo .env padrão no repositório local.',
    impact: 'Potencial commit e vazamento de chaves privadas em repositórios remotos.',
    controlsConsidered: 'O arquivo .env.local atual está ignorado por *.local.',
    recommendation: 'Adicionar .env, .env.* e !.env.example explicitamente no arquivo .gitignore.',
    prio: 'P3'
  }
];

// ─── PONTOS FORTES CONFIRMADOS ─────────────────────────────────
const strengths = [
  {
    id: 'S01',
    title: 'Row Level Security (RLS) Ativo com Isolamento Multi-Tenant por auth.uid()',
    evidence: 'schema.sql:70-88 (schedules), 133-161 (licenses), 174-188 (notifications), 201-214 (tickets)',
    description: 'Políticas RLS garantem que usuários comuns não visualizem, atualizem ou excluam dados pertencentes a outros usuários, exigindo correspondência estrita com auth.uid() = user_id.'
  },
  {
    id: 'S02',
    title: 'Trigger de Proteção contra Manipulação de Licenciamento de Grades',
    evidence: 'schema.sql:90-109 (trg_protect_schedule_license)',
    description: 'Trigger BEFORE INSERT OR UPDATE protege o campo is_licensed na tabela schedules, impedindo que usuários comuns alterem o status de licença via queries diretas no PostgREST.'
  },
  {
    id: 'S03',
    title: 'Buckets de Armazenamento Privados com Isolamento de Pastas por UUID',
    evidence: 'schema.sql:489-538 (receipts e tickets-attachments)',
    description: 'Buckets receipts e tickets-attachments são privados (public = false). As políticas de Storage RLS exigem que a pasta de primeiro nível corresponda a auth.uid()::text, impedindo upload e leitura não autorizados.'
  },
  {
    id: 'S04',
    title: 'Funções RPC com SECURITY DEFINER e Validação Obrigatória de Privilégio Admin',
    evidence: 'schema.sql:238-375 (get_admin_licenses, approve_license_rpc, delete_license_rpc, get_pending_licenses_count_rpc)',
    description: 'Todas as RPCs administrativas executam checagem explícita IF NOT public.is_admin() THEN RAISE EXCEPTION antes de executar mutações ou consultas sensíveis.'
  },
  {
    id: 'S05',
    title: 'Arquitetura de Paywall Server-Side Estruturada na RPC get_schedule_solution',
    evidence: 'schema.sql:449-485 (get_schedule_solution)',
    description: 'A RPC get_schedule_solution valida propriedade do horário (v_owner_id = auth.uid()) e exige comprovação de licença ativa no banco de dados antes de retornar os dados da solução.'
  },
  {
    id: 'S06',
    title: 'Defesa em Profundidade nas Consultas do Cliente Frontend',
    evidence: 'services/scheduleService.ts:79, 180, 212, 230, 258, 274, 289; services/notificationService.ts:18, 35, 53, 66',
    description: 'Todos os métodos de serviço do frontend filtram explicitamente .eq(\'user_id\', user.id), garantindo filtro duplo (client + RLS) contra falhas de tenant.'
  },
  {
    id: 'S07',
    title: 'Ausência de Sinks de XSS Perigosos no Frontend (React 19 Nativo)',
    evidence: 'Varredura estática completa em todos os arquivos .tsx e .ts',
    description: 'O código utiliza exclusivamente JSX com auto-escaping. Zero ocorrências de dangerouslySetInnerHTML, innerHTML, v-html, eval() ou new Function().'
  },
  {
    id: 'S08',
    title: 'Sanitização de Extensões e Validação de Tipos MIME nos Uploads',
    evidence: 'services/ticketService.ts:24-30 e pages/PlansPage.tsx:100-101',
    description: 'Uploads validam extensões permitidas (png, jpg, webp, pdf), MIME types aceitos e limite estrito de 5MB, com higienização de extensões por regex alfanumérico.'
  },
  {
    id: 'S09',
    title: 'Autenticação Segura via Supabase Auth com Verificação OTP e Reset Seguro',
    evidence: 'services/authService.ts',
    description: 'Fluxo de autenticação completo gerenciado pelo GoTrue, com OTP de 6 dígitos para verificação de e-mail, refresh automático de JWT e reset de senha.'
  },
  {
    id: 'S10',
    title: 'Inexistência de Chaves Privadas ou service_role Expostas no Repositório',
    evidence: 'Inspeção profunda de .env.local, bundle de build e histórico Git',
    description: 'A chave configurada no frontend é estritamente a Anon Key pública do Supabase. A chave mestra service_role e certificados privados não estão presentes no repositório.'
  }
];

// ─── MATRIZ DE COBERTURA ───────────────────────────────────────
const coverageMatrix = [
  {
    category: '1. Isolamento de dados / Cross-tenant',
    scope: 'Tabelas do banco, storage buckets e RPCs',
    controls: 'RLS por auth.uid(), storage foldername, RPC SECURITY DEFINER',
    items: '6 tabelas, 2 buckets, 7 RPCs (15 itens)',
    findings: '1 confirmado (F02: audit_logs)',
    coverage: '100%'
  },
  {
    category: '2. Autorização no navegador',
    scope: 'Gates de UI (isAdmin, isLicensed), paywall e RPCs',
    controls: 'RPCs admin com is_admin(), RPC get_schedule_solution, trigger',
    items: '5 fluxos de privilégio / paywall',
    findings: '2 confirmados (F01: paywall SELECT, F04: insert licenses)',
    coverage: '100%'
  },
  {
    category: '3. IDOR / Ownership',
    scope: 'Todos os handlers e métodos em services/*.ts',
    controls: 'Filtros .eq(\'user_id\') e políticas RLS de propriedade',
    items: '18 handlers/métodos de serviço',
    findings: '0 confirmados (100% verificados e protegidos)',
    coverage: '100%'
  },
  {
    category: '4. Secrets e credenciais',
    scope: 'Código-fonte, .env.local, .gitignore, bundle, histórico Git',
    controls: 'Exclusão *.local no .gitignore, anon key pública por design',
    items: '6 arquivos config/env + 20+ commits Git',
    findings: '2 confirmados (F05: e-mails hardcoded, F06: .gitignore)',
    coverage: '100%'
  },
  {
    category: '5. Inputs sem tratamento / XSS',
    scope: 'Renderização JSX, tags href/src/iframe, sanitização',
    controls: 'Escapamento nativo React 19, validação de arquivos',
    items: '9 páginas, 9 componentes, todos os sinks href/src',
    findings: '1 confirmado (F03: Stored XSS via receipt_url)',
    coverage: '100%'
  }
];

// ─── RECOMENDAÇÕES PRIORIZADAS ─────────────────────────────────
const recommendations = [
  { priority: 'P1', text: 'Isolar a solução de horários (fixedLessons) no banco de dados para que não seja transmitida no SELECT * da tabela schedules, eliminando o bypass do paywall.' },
  { priority: 'P1', text: 'Corrigir a política RLS da tabela audit_logs para USING (auth.uid() = user_id OR public.is_admin()), impedindo vazamento e adulteração cross-tenant.' },
  { priority: 'P1', text: 'Sanitizar e validar rigorosamente o campo receipt_url em AdminPanelPage.tsx e schema.sql, bloqueando esquemas javascript: e iframes com origens arbitrárias.' },
  { priority: 'P2', text: 'Revogar o INSERT direto em licenses para usuários autenticados, forçando o uso exclusivo da RPC request_license_order para prevenir adulteração de preços.' },
  { priority: 'P2', text: 'Remover e-mails de administradores hardcoded de schema.sql e Layout.tsx, centralizando o controle na tabela admin_users e RPC is_current_user_admin().' },
  { priority: 'P3', text: 'Expandir o .gitignore para incluir padrões universais de ambiente (.env, .env.*, !.env.example).' }
];

// ─── ISSUES GITHUB ─────────────────────────────────────────────
const issues = [
  {
    title: '[Segurança] Paywall Server-Side: Bloquear vazamento da grade (fixedLessons) no SELECT de schedules',
    labels: 'security, critica',
    description: 'A solução dos horários escolares gerados (`fixedLessons`) é salva integralmente na coluna JSONB `data` da tabela `schedules`. A política de RLS de SELECT permite ao proprietário ler a grade completa sem verificar se o horário está licenciado (`is_licensed = true`). O frontend tenta mascarar a solução em memória (`scheduleService.ts:126-130`), mas qualquer usuário pode inspecionar a resposta HTTP da API do Supabase e obter o horário completo sem pagar.',
    why: 'O controle de paywall é imposto unicamente em memória do cliente, enquanto a API do banco expõe a solução completa no SELECT.',
    evidence: '`schema.sql:87-88`\n`services/scheduleService.ts:77-81`\n`services/scheduleService.ts:126-130`',
    snippet: `// services/scheduleService.ts:126-130
const safeData = isApproved ? normalizedData : {
    ...normalizedData,
    fixedLessons: []
};`,
    impact: 'Evasão completa do modelo de monetização. Usuários comuns extraem os cronogramas escolares otimizados gratuitamente.',
    fix: '1. Criar uma VIEW com RLS ou função segura que retorne `data` sem a chave `fixedLessons` quando `is_licensed = false`.\n2. Exigir o uso exclusivo da RPC `get_schedule_solution` para recuperar as aulas alocadas.\n3. Garantir que a query `SELECT * FROM schedules` nunca retorne `fixedLessons` para grades sem licença ativa.',
    acceptance: '- [ ] `SELECT * FROM schedules` não retorna `fixedLessons` quando `is_licensed = false`\n- [ ] Solução só é entregue via `get_schedule_solution` mediante validação de licença ativa no PostgreSQL\n- [ ] Usuários não pagantes não conseguem acessar o cronograma completo via DevTools'
  },
  {
    title: '[Segurança] RLS Indevido na tabela audit_logs permite acesso e adulteração cross-tenant irrestrita',
    labels: 'security, alta',
    description: 'A política de segurança da tabela `audit_logs` foi criada com `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. Qualquer usuário autenticado no sistema tem permissão para listar todos os registros de auditoria de outros clientes, além de poder injetar logs forjados ou apagar todo o histórico de auditoria.',
    why: 'A cláusula `USING (true)` anula completamente o isolamento entre tenants no PostgreSQL.',
    evidence: '`schema.sql:233-235`\n`CREATE POLICY "Permitir acesso audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);`',
    snippet: `DROP POLICY IF EXISTS "Permitir acesso audit_logs" ON public.audit_logs;
CREATE POLICY "Permitir acesso audit_logs" 
ON public.audit_logs FOR ALL TO authenticated 
USING (true) WITH CHECK (true);`,
    impact: 'Vazamento de dados confidenciais entre escolas/tenants, falsificação de registros de auditoria e exclusão maliciosa de trilhas de auditoria.',
    fix: '1. Dropar a política permissiva existente.\n2. Criar política restritiva que permita aos usuários visualizarem apenas seus próprios registros (`auth.uid() = user_id`) e administradores visualizarem todos.\n3. Bloquear mutações diretas (INSERT/UPDATE/DELETE) para usuários comuns.',
    acceptance: '- [ ] Usuário comum só consegue consultar linhas de `audit_logs` onde `user_id = auth.uid()`\n- [ ] Tentativas de SELECT cruzado entre tenants retornam zero resultados\n- [ ] Tentativas de UPDATE/DELETE por usuários comuns são rejeitadas pelo PostgreSQL'
  },
  {
    title: '[Segurança] Stored XSS no painel de administração via URL de comprovante de licença',
    labels: 'security, alta',
    description: 'O campo `receipt_url` da tabela `licenses` aceita qualquer string enviada pelo usuário. Em `AdminPanelPage.tsx:87-109`, quando `createSignedUrl` falha, o código repassa a string crua para `viewingReceiptUrl`. O componente renderiza `<iframe src={viewingReceiptUrl}>` se o texto terminar em `.pdf` (ex: `javascript:alert(document.domain)//.pdf`). Isso aciona execução de código no navegador do administrador ao abrir o comprovante.',
    why: 'Falta de validação de protocolo/esquema na URL do comprovante combinada com renderização de iframe com conteúdo controlado pelo usuário.',
    evidence: '`pages/AdminPanelPage.tsx:87-109`\n`pages/AdminPanelPage.tsx:338, 351-356`\n`schema.sql:113-125`',
    snippet: `// AdminPanelPage.tsx:108
setViewingReceiptUrl(urlOrPath);
// AdminPanelPage.tsx:351-353
{viewingReceiptUrl.endsWith('.pdf') ? (
    <iframe src={viewingReceiptUrl} title="Comprovante PDF" ... />
) : ...}`,
    impact: 'Execução de JavaScript arbitrário no contexto de sessão do administrador, permitindo roubo de token JWT e disparo de ações administrativas (aprovação/exclusão de licenças).',
    fix: '1. Validar que `receipt_url` segue o padrão estrito de armazenamento do Supabase (`<uuid>/<filename>`).\n2. Nunca renderizar `iframe` com URIs que não pertençam ao domínio oficial do storage do Supabase com protocolo `https:`.\n3. Sanitizar o link de download externo garantindo protocolo seguro.',
    acceptance: '- [ ] Strings que não comecem com `https://` ou caminho de storage válido são rejeitadas\n- [ ] URIs com esquema `javascript:` ou `data:` não são carregadas em `iframe` nem em tags `<a>`\n- [ ] Teste de carga com `javascript:...//.pdf` não executa script'
  },
  {
    title: '[Segurança] Restringir inserção em licenses à RPC request_license_order para evitar adulteração de preços',
    labels: 'security, alta',
    description: 'A política RLS da tabela `licenses` permite que qualquer usuário autenticado insira registros diretamente com `payment_status` em `Aguardando`. O frontend possui um bloco de fallback em `PlansPage.tsx:128-139` que faz `INSERT` direto com valores de `value_paid` e `classes_amount` controlados pelo cliente. Um atacante pode enviar requisição PostgREST direta e criar pedidos de 100 turmas com valor de R$ 0,01.',
    why: 'A tabela `licenses` aceita INSERT direto por clientes em vez de exigir a execução da RPC de cálculo de preço.',
    evidence: '`pages/PlansPage.tsx:127-147`\n`schema.sql:151-161`',
    snippet: `// schema.sql:151-161
CREATE POLICY "Users can insert their own licenses" ON public.licenses
FOR INSERT TO authenticated 
WITH CHECK (
    auth.uid() = user_id 
    AND (payment_status IN ('Aguardando', 'under_review') OR payment_status IS NULL)
);`,
    impact: 'Manipulação de valores financeiros e criação de pedidos com valores incorretos ou fraudulentos na fila de análise do administrador.',
    fix: '1. Remover a política de INSERT direto para `authenticated` na tabela `licenses`.\n2. Forçar que todos os pedidos sejam criados unicamente através da RPC `request_license_order`.\n3. Remover o bloco de fallback client-side em `PlansPage.tsx`.',
    acceptance: '- [ ] Requisições `POST /rest/v1/licenses` diretas retornam 403 / erro de RLS\n- [ ] Pedidos de licença só podem ser criados via `request_license_order`\n- [ ] Valores de licença são sempre auditados e calculados no servidor'
  },
  {
    title: '[Segurança] Remover e-mails de administradores hardcoded no banco e no frontend',
    labels: 'security, media',
    description: 'Os e-mails dos administradores mestres estão gravados de forma estática em `schema.sql:29, 36, 40` e em `components/Layout.tsx:72`. Isso expõe a identidade dos administradores no código-fonte e bundle JavaScript entregue ao usuário, além de dificultar o gerenciamento e revogação de acessos.',
    why: 'Os e-mails constam como literais de string na função `is_admin()` e no layout do frontend.',
    evidence: '`schema.sql:29` — `OR (v_user_email IN (\'horium.app@gmail.com\', \'prof.jackison@gmail.com\'));`\n`components/Layout.tsx:72` — `const isMasterAdmin = [\'horium.app@gmail.com\', \'prof.jackison@gmail.com\'].includes(userEmailLower);`',
    snippet: `// schema.sql:29
OR (v_user_email IN ('horium.app@gmail.com', 'prof.jackison@gmail.com'));`,
    impact: 'Exposição pública da lista de administradores, favorecendo ataques de phishing direcionado e ataques de engenharia social.',
    fix: '1. Remover os e-mails literais da função `is_admin()` no PostgreSQL, consultando exclusivamente a tabela `admin_users`.\n2. Remover a verificação estática de e-mails em `Layout.tsx`, utilizando a RPC `is_current_user_admin()` para determinar o papel do usuário logado.',
    acceptance: '- [ ] Nenhum e-mail de administrador aparece no bundle gerado pelo Vite\n- [ ] A função `is_admin()` depende unicamente de registros na tabela `admin_users`\n- [ ] O frontend consulta o status de administrador através da RPC oficial'
  },
  {
    title: '[Segurança] Adicionar padrões .env e .env.* ao .gitignore para prevenir commit acidental de segredos',
    labels: 'security, baixa',
    description: 'O arquivo `.gitignore` atualmente inclui apenas o padrão `*.local`. Caso desenvolvedores criem arquivos de ambiente padrão como `.env` ou `.env.production` contendo credenciais de serviços externos ou chaves de serviço do Supabase, o Git rastreará esses arquivos automaticamente.',
    why: 'O padrão `.gitignore` não protege nomes de arquivo de variáveis de ambiente sem o sufixo `.local`.',
    evidence: '`.gitignore:13` — `*.local`',
    snippet: `// .gitignore:13
*.local`,
    impact: 'Risco de versionamento acidental de chaves secretas em repositórios remotos.',
    fix: 'Adicionar as linhas `.env`, `.env.*` e `!.env.example` ao arquivo `.gitignore`.',
    acceptance: '- [ ] Arquivos `.env` e `.env.production` são ignorados pelo `git status`\n- [ ] Apenas `.env.example` (se existente) pode ser rastreado'
  }
];

// ─── HELPERS DE DESENHO NO PDF ─────────────────────────────────

function hexToRGB(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16)
  ];
}

function createDoc() {
  return new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: `Relatório de Auditoria de Segurança — ${PROJECT_NAME}`,
      Author: 'Auditoria de Segurança Estática e Baseada em Evidências',
      Subject: 'Segurança da Aplicação e Infraestrutura de Dados'
    }
  });
}

function addHeaderFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    // Não desenha cabeçalho nem rodapé na capa (página 0)
    if (i === 0) continue;

    // Header
    doc.save();
    doc.fontSize(7.5).font('Helvetica').fillColor('#6B7280')
      .text(`Relatório de Auditoria de Segurança — ${PROJECT_NAME}`, MARGIN, 24, { width: CONTENT_W, align: 'left' });
    doc.fontSize(7.5).font('Helvetica').fillColor('#9CA3AF')
      .text('CONFIDENCIAL', MARGIN, 24, { width: CONTENT_W, align: 'right' });
    doc.moveTo(MARGIN, 36).lineTo(PAGE_W - MARGIN, 36).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.restore();

    // Footer
    doc.save();
    doc.moveTo(MARGIN, PAGE_H - 36).lineTo(PAGE_W - MARGIN, PAGE_H - 36).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor('#6B7280')
      .text(`Página ${i + 1} de ${pages.count}`, MARGIN, PAGE_H - 26, { width: CONTENT_W, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor('#9CA3AF')
      .text(`${AUDIT_DATE}`, MARGIN, PAGE_H - 26, { width: CONTENT_W, align: 'left' });
    doc.restore();
  }
}

function drawDonutChart(doc, x, y, radius, data, innerRadiusFactor = 0.55) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;
  const innerRadius = radius * innerRadiusFactor;

  data.forEach(d => {
    if (d.value === 0) return;
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const rgb = hexToRGB(d.color);

    doc.save();
    doc.fillColor(rgb);

    const steps = Math.max(24, Math.ceil(sliceAngle * 36));
    const angleStep = sliceAngle / steps;

    const ox1 = x + radius * Math.cos(startAngle);
    const oy1 = y + radius * Math.sin(startAngle);
    doc.moveTo(ox1, oy1);

    for (let i = 0; i <= steps; i++) {
      const a = startAngle + i * angleStep;
      doc.lineTo(x + radius * Math.cos(a), y + radius * Math.sin(a));
    }

    const ix2 = x + innerRadius * Math.cos(endAngle);
    const iy2 = y + innerRadius * Math.sin(endAngle);
    doc.lineTo(ix2, iy2);

    for (let i = steps; i >= 0; i--) {
      const a = startAngle + i * angleStep;
      doc.lineTo(x + innerRadius * Math.cos(a), y + innerRadius * Math.sin(a));
    }

    doc.closePath();
    doc.fill();
    doc.restore();

    startAngle = endAngle;
  });

  // Texto central
  doc.save();
  doc.fontSize(16).fillColor('#111418').font('Helvetica-Bold');
  const totalStr = String(total);
  const tw = doc.widthOfString(totalStr);
  doc.text(totalStr, x - tw / 2, y - 10, { lineBreak: false });
  doc.fontSize(7.5).fillColor('#6B7280').font('Helvetica');
  const label = 'achados';
  const lw = doc.widthOfString(label);
  doc.text(label, x - lw / 2, y + 8, { lineBreak: false });
  doc.restore();
}

function drawBarChart(doc, x, y, width, height, data) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = 24;
  const gap = (width - data.length * barWidth) / (data.length + 1);

  // Linhas horizontais de grade
  doc.save();
  doc.strokeColor('#E5E7EB').lineWidth(0.5);
  for (let i = 0; i <= 4; i++) {
    const gy = y + height - (height * i / 4);
    doc.moveTo(x, gy).lineTo(x + width, gy).stroke();
  }
  doc.restore();

  data.forEach((d, i) => {
    const barH = d.value > 0 ? (d.value / maxVal) * (height - 24) : 0;
    const bx = x + gap + i * (barWidth + gap);
    const by = y + height - barH;
    const rgb = hexToRGB(d.color);

    if (barH > 0) {
      doc.save();
      doc.fillColor(rgb);
      doc.roundedRect(bx, by, barWidth, barH, 2).fill();
      doc.restore();
    }

    // Rótulo de valor
    doc.save();
    doc.fontSize(7.5).fillColor('#374151').font('Helvetica-Bold');
    const vStr = String(d.value);
    const vw = doc.widthOfString(vStr);
    doc.text(vStr, bx + barWidth / 2 - vw / 2, by - 10, { lineBreak: false });
    doc.restore();

    // Rótulo da categoria
    doc.save();
    doc.fontSize(6).fillColor('#6B7280').font('Helvetica');
    const cStr = d.shortLabel || d.label;
    const cw = doc.widthOfString(cStr);
    doc.text(cStr, bx + barWidth / 2 - cw / 2, y + height + 4, { lineBreak: false });
    doc.restore();
  });
}

function drawSeverityChip(doc, x, y, severity) {
  const sev = SEV[severity] || SEV.informativa;
  const rgb = hexToRGB(sev.color);
  const label = sev.label.toUpperCase();
  const fontSize = 6.5;

  doc.save();
  doc.fontSize(fontSize).font('Helvetica-Bold');
  const tw = doc.widthOfString(label);
  const badgeW = tw + 10;
  const badgeH = 13;

  doc.fillColor(rgb).roundedRect(x, y, badgeW, badgeH, 3).fill();
  doc.fillColor('#FFFFFF').text(label, x + 5, y + 3, { lineBreak: false });
  doc.restore();

  return badgeW;
}

function ensureSpace(doc, needed, label = '') {
  if (doc.y + needed > PAGE_H - MARGIN - 30) {
    console.log(`[ensureSpace] Page added by '${label}' at y=${doc.y.toFixed(1)}, needed=${needed}`);
    doc.addPage();
    doc.y = MARGIN + 10;
  }
}

// ─── GERAÇÃO DO DOCUMENTO ──────────────────────────────────────

async function generatePDF() {
  const outputPath = path.join(__dirname, 'relatorio-auditoria-seguranca.pdf');
  const doc = createDoc();
  doc.on('pageAdded', () => console.log(`[PDFKit Event] Page Added, count: ${doc.bufferedPageRange().count}`));
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // ══════════════════════════════════════════════════════════════
  // PÁGINA 1 — CAPA
  // ══════════════════════════════════════════════════════════════
  doc.save();
  doc.fillColor(hexToRGB('#136DEC')).rect(0, 0, PAGE_W, 8).fill();
  doc.restore();

  doc.y = 110;
  doc.fontSize(24).font('Helvetica-Bold').fillColor('#111418')
    .text('Relatório de Auditoria de Segurança', MARGIN, doc.y, { width: CONTENT_W, align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#136DEC')
    .text(PROJECT_NAME, { width: CONTENT_W, align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica').fillColor('#6B7280')
    .text('Análise Estática de Segurança Baseada em Evidências do Código-Fonte e Configurações', { width: CONTENT_W, align: 'center' });

  doc.y = 230;
  const boxY = doc.y;
  doc.save();
  doc.fillColor(hexToRGB('#F9FAFB')).roundedRect(MARGIN + 30, boxY, CONTENT_W - 60, 210, 8).fill();
  doc.strokeColor(hexToRGB('#E5E7EB')).lineWidth(1).roundedRect(MARGIN + 30, boxY, CONTENT_W - 60, 210, 8).stroke();
  doc.restore();

  const infoX = MARGIN + 48;
  let infoY = boxY + 16;
  const lineH = 19;

  const metadataRows = [
    ['Data da Auditoria:', AUDIT_DATE],
    ['Projeto / Repositório:', 'Horium (Sistema de Gestão de Horário Escolar)'],
    ['Escopo Auditado:', 'Código-fonte integral (React 19 Frontend + Schema SQL + Storage)'],
    ['Linguagem / Framework:', 'TypeScript, React 19, Vite 6, TailwindCSS 4'],
    ['Banco de Dados / Backend:', 'PostgreSQL gerenciado (Supabase), PostgREST, RPCs PL/pgSQL'],
    ['Mecanismo de Autenticação:', 'Supabase Auth (GoTrue com JWT, verificação OTP de 6 dígitos)'],
    ['Mecanismo de Autorização:', 'Row Level Security (RLS), Triggers PostgreSQL e RPCs com SECURITY DEFINER'],
    ['Armazenamento de Arquivos:', 'Supabase Storage (Buckets receipts e tickets-attachments privados)'],
    ['Infraestrutura / CI/CD:', 'IaC baseada em SQL (schema.sql). Sem Docker/Kubernetes/CI configurados.'],
  ];

  metadataRows.forEach(([lbl, val]) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151').text(lbl, infoX, infoY, { width: 150, lineBreak: false });
    doc.font('Helvetica').fillColor('#4B5563').text(val, infoX + 155, infoY, { width: CONTENT_W - 220 });
    infoY += lineH;
  });

  doc.y = 470;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937')
    .text('Nota Metodológica & Rigor de Evidências', MARGIN + 30, doc.y, { width: CONTENT_W - 60, align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(7.5).font('Helvetica').fillColor('#4B5563')
    .text(
      'Esta auditoria seguiu a regra fundamental de verificação estática: nenhum achado foi registrado sem uma cadeia demonstrável e confirmada no código real (entrada controlável -> fluxo relevante -> recurso sensível -> ausência/bypass de controle efetivo). Controles aplicados indiretamente por RLS, triggers e funções seguras foram avaliados integralmente antes da confirmação de cada vulnerabilidade.',
      MARGIN + 30, doc.y, { width: CONTENT_W - 60, align: 'justify', lineGap: 2 }
    );

  doc.moveDown(1);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937')
    .text('Limitações da Auditoria', MARGIN + 30, doc.y, { width: CONTENT_W - 60, align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(7.5).font('Helvetica').fillColor('#4B5563')
    .text(
      'A análise concentrou-se no código-fonte do repositório local, no esquema de dados PostgreSQL (schema.sql) e no histórico Git disponível. Não foram executados testes de intrusão ativos contra instâncias de produção do Supabase nem análises dinâmicas de carga. Testes funcionais não modificaram código ou dados.',
      MARGIN + 30, doc.y, { width: CONTENT_W - 60, align: 'justify', lineGap: 2 }
    );

  // ══════════════════════════════════════════════════════════════
  // PÁGINA 2 — RESUMO EXECUTIVO & GRÁFICOS
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  doc.y = MARGIN + 10;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#111418').text('Resumo Executivo', MARGIN, doc.y);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + 160, doc.y + 2).strokeColor('#136DEC').lineWidth(2).stroke();
  doc.moveDown(1.2);

  // Contagens por severidade
  const sevCounts = {
    critica: findings.filter(f => f.severity === 'critica').length,
    alta: findings.filter(f => f.severity === 'alta').length,
    media: findings.filter(f => f.severity === 'media').length,
    baixa: findings.filter(f => f.severity === 'baixa').length,
  };

  // Cards de severidade
  const cardY = doc.y;
  const cardW = (CONTENT_W - 30) / 4;
  const orderSev = ['critica', 'alta', 'media', 'baixa'];

  orderSev.forEach((sev, i) => {
    const cx = MARGIN + i * (cardW + 10);
    const count = sevCounts[sev];
    const rgb = hexToRGB(SEV[sev].color);
    const bgRgb = hexToRGB(SEV[sev].bg);
    const borderRgb = hexToRGB(SEV[sev].border);

    doc.save();
    doc.fillColor(bgRgb).strokeColor(borderRgb).lineWidth(1).roundedRect(cx, cardY, cardW, 46, 6).fillAndStroke();
    doc.fillColor(rgb).font('Helvetica-Bold').fontSize(18).text(String(count), cx + 10, cardY + 7, { lineBreak: false });
    doc.fillColor(rgb).font('Helvetica-Bold').fontSize(7.5).text(SEV[sev].label.toUpperCase(), cx + 10, cardY + 30, { lineBreak: false });
    doc.restore();
  });

  doc.y = cardY + 62;

  // Gráficos
  const chartY = doc.y;

  // Gráfico de Rosca (Donut)
  const donutData = [
    { value: sevCounts.critica, color: SEV.critica.color, label: 'Crítica' },
    { value: sevCounts.alta, color: SEV.alta.color, label: 'Alta' },
    { value: sevCounts.media, color: SEV.media.color, label: 'Média' },
    { value: sevCounts.baixa, color: SEV.baixa.color, label: 'Baixa' }
  ];

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937').text('Distribuição por Severidade', MARGIN + 10, chartY);
  drawDonutChart(doc, MARGIN + 85, chartY + 65, 46, donutData, 0.55);

  let legY = chartY + 28;
  donutData.forEach(d => {
    doc.save();
    doc.fillColor(hexToRGB(d.color)).rect(MARGIN + 145, legY + 2, 7, 7).fill();
    doc.fillColor('#374151').font('Helvetica').fontSize(7.5).text(`${d.label}: ${d.value} achado(s)`, MARGIN + 158, legY, { lineBreak: false });
    doc.restore();
    legY += 16;
  });

  // Gráfico de Barras por Categoria
  const catData = [
    { label: 'Isolamento / Tenant', shortLabel: 'Isolamento', value: findings.filter(f => f.category.includes('Isolamento')).length, color: '#EA580C' },
    { label: 'Autorização Frontend', shortLabel: 'Autoriz. UI', value: findings.filter(f => f.category.includes('Autorização')).length, color: '#B91C1C' },
    { label: 'IDOR / Ownership', shortLabel: 'IDOR', value: 0, color: '#059669' },
    { label: 'Secrets / Credenciais', shortLabel: 'Secrets', value: findings.filter(f => f.category.includes('Secrets')).length, color: '#D97706' },
    { label: 'XSS / Sanitização', shortLabel: 'XSS / URI', value: findings.filter(f => f.category.includes('XSS')).length, color: '#EA580C' },
  ];

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937').text('Distribuição por Categoria', MARGIN + 260, chartY);
  drawBarChart(doc, MARGIN + 260, chartY + 20, 210, 85, catData);

  doc.y = chartY + 130;

  // Pontos Fracos (Riscos Centrais)
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#B91C1C').text('✗ Pontos Fracos & Riscos Centrais', MARGIN, doc.y);
  doc.moveDown(0.4);

  const mainRisks = [
    'Bypass de Paywall no SELECT: Grades completas (fixedLessons) são enviadas via rede a usuários não licenciados e ocultadas apenas na memória do cliente.',
    'Isolamento RLS Ausente em audit_logs: Política USING (true) permite que qualquer usuário autenticado leia, forje ou destrua logs de auditoria de todos os tenants.',
    'Stored XSS no Painel Admin: URL de comprovante de licença não higienizada é renderizada em iframe e tag <a>, viabilizando sequestro de sessão administrativa.',
    'Bypass de Precificação via INSERT Direto: A tabela licenses permite inserção direta sem passar pela RPC request_license_order, admitindo valores arbitrários.',
    'Hardcoding de E-mails Administrativos: E-mails de admins mestre expostos no código e no bundle, gerando rigidez e risco de engenharia social.'
  ];

  mainRisks.forEach((risk, idx) => {
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#991B1B').text(`${idx + 1}. `, MARGIN + 8, doc.y, { continued: true });
    doc.font('Helvetica').fillColor('#374151').text(risk, { width: CONTENT_W - 20, lineGap: 2 });
    doc.moveDown(0.2);
  });

  // ══════════════════════════════════════════════════════════════
  // PÁGINA 3 — PONTOS FORTES CONFIRMADOS
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  doc.y = MARGIN + 10;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#111418').text('Pontos Fortes Confirmados', MARGIN, doc.y);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + 220, doc.y + 2).strokeColor('#059669').lineWidth(2).stroke();
  doc.moveDown(0.8);

  doc.fontSize(7.5).font('Helvetica').fillColor('#4B5563')
    .text('Os seguintes controles foram inspecionados diretamente no código-fonte e esquemas SQL, com eficácia comprovada:', MARGIN, doc.y);
  doc.moveDown(0.8);

  strengths.forEach(s => {
    ensureSpace(doc, 38);
    const itemY = doc.y;

    doc.save();
    doc.fillColor(hexToRGB('#F0FDF4')).strokeColor(hexToRGB('#BBF7D0')).lineWidth(0.5).roundedRect(MARGIN, itemY, CONTENT_W, 34, 4).fillAndStroke();
    doc.restore();

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#065F46')
      .text(`✓ [${s.id}] ${s.title}`, MARGIN + 8, itemY + 5, { width: CONTENT_W - 16 });
    doc.fontSize(7).font('Helvetica').fillColor('#374151')
      .text(s.description, MARGIN + 8, itemY + 16, { width: CONTENT_W - 16, lineBreak: false });
    doc.fontSize(6.5).font('Courier').fillColor('#059669')
      .text(`Evidência: ${s.evidence}`, MARGIN + 8, itemY + 24, { width: CONTENT_W - 16, lineBreak: false });

    doc.y = itemY + 38;
  });

  // ══════════════════════════════════════════════════════════════
  // PÁGINA 4 — MATRIZ DE COBERTURA & TABELA DE ACHADOS
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  doc.y = MARGIN + 10;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#111418').text('Matriz de Cobertura da Auditoria', MARGIN, doc.y);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + 260, doc.y + 2).strokeColor('#136DEC').lineWidth(2).stroke();
  doc.moveDown(0.8);

  // Tabela da Matriz de Cobertura
  const colW = [110, 115, 115, 60, 45, 40]; // Soma = 485 ~ CONTENT_W
  const tableHeaderY = doc.y;

  doc.save();
  doc.fillColor(hexToRGB('#1F2937')).roundedRect(MARGIN, tableHeaderY, CONTENT_W, 20, 3).fill();
  doc.restore();

  const headers = ['Categoria', 'Escopo Analisado', 'Controles Encontrados', 'Itens', 'Achados', 'Cob.'];
  let hx = MARGIN + 4;
  headers.forEach((h, idx) => {
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#FFFFFF').text(h, hx, tableHeaderY + 6, { width: colW[idx] - 6, align: idx >= 3 ? 'center' : 'left' });
    hx += colW[idx];
  });

  let rowY = tableHeaderY + 20;
  coverageMatrix.forEach((row, rIdx) => {
    doc.save();
    if (rIdx % 2 === 1) {
      doc.fillColor(hexToRGB('#F9FAFB')).rect(MARGIN, rowY, CONTENT_W, 24).fill();
    }
    doc.strokeColor(hexToRGB('#E5E7EB')).lineWidth(0.5).moveTo(MARGIN, rowY + 24).lineTo(PAGE_W - MARGIN, rowY + 24).stroke();
    doc.restore();

    let rx = MARGIN + 4;
    const rData = [row.category, row.scope, row.controls, row.items, row.findings, row.coverage];
    rData.forEach((val, cIdx) => {
      doc.fontSize(6.5).font(cIdx === 0 ? 'Helvetica-Bold' : 'Helvetica').fillColor('#374151')
        .text(val, rx, rowY + 4, { width: colW[cIdx] - 6, align: cIdx >= 3 ? 'center' : 'left' });
      rx += colW[cIdx];
    });

    rowY += 24;
  });

  doc.y = rowY + 16;

  // TABELA RESUMO DE ACHADOS DETALHADOS
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#111418').text('Tabela Resumo dos Achados Confirmados', MARGIN, doc.y);
  doc.moveDown(0.5);

  const tFindH_Y = doc.y;
  doc.save();
  doc.fillColor(hexToRGB('#1F2937')).roundedRect(MARGIN, tFindH_Y, CONTENT_W, 18, 3).fill();
  doc.restore();

  doc.fontSize(7).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('Severidade', MARGIN + 8, tFindH_Y + 5, { width: 60 });
  doc.text('Arquivo:Linha', MARGIN + 75, tFindH_Y + 5, { width: 140 });
  doc.text('Descrição do Achado Confirmado', MARGIN + 225, tFindH_Y + 5, { width: CONTENT_W - 230 });

  let fRowY = tFindH_Y + 18;
  findings.forEach((f, idx) => {
    doc.save();
    if (idx % 2 === 1) {
      doc.fillColor(hexToRGB('#F9FAFB')).rect(MARGIN, fRowY, CONTENT_W, 22).fill();
    }
    doc.strokeColor(hexToRGB('#E5E7EB')).lineWidth(0.5).moveTo(MARGIN, fRowY + 22).lineTo(PAGE_W - MARGIN, fRowY + 22).stroke();
    doc.restore();

    drawSeverityChip(doc, MARGIN + 6, fRowY + 4, f.severity);
    doc.fontSize(6.5).font('Courier').fillColor('#1F2937').text(f.file, MARGIN + 75, fRowY + 5, { width: 140, lineBreak: false });
    doc.fontSize(6.5).font('Helvetica').fillColor('#374151').text(f.title, MARGIN + 225, fRowY + 5, { width: CONTENT_W - 235, lineBreak: false });

    fRowY += 22;
  });

  // ══════════════════════════════════════════════════════════════
  // PÁGINA 5 EM DIANTE — FICHAS COMPLETAS DE ACHADOS
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  doc.y = MARGIN + 10;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#111418').text('Achados Detalhados com Evidências', MARGIN, doc.y);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + 280, doc.y + 2).strokeColor('#136DEC').lineWidth(2).stroke();
  doc.moveDown(1);

  findings.forEach(f => {
    ensureSpace(doc, 190);
    const cardTop = doc.y;

    // Cabeçalho do Card
    doc.save();
    doc.fillColor(hexToRGB('#F9FAFB')).strokeColor(hexToRGB('#E5E7EB')).lineWidth(1)
      .roundedRect(MARGIN, cardTop, CONTENT_W, 28, 4).fillAndStroke();
    doc.restore();

    const chipW = drawSeverityChip(doc, MARGIN + 8, cardTop + 7, f.severity);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111418')
      .text(`[${f.id}] ${f.title}`, MARGIN + chipW + 16, cardTop + 8, { width: CONTENT_W - chipW - 24 });

    doc.y = cardTop + 34;

    // Metadados do achado
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151').text('Categoria: ', MARGIN + 4, doc.y, { continued: true })
      .font('Helvetica').fillColor('#4B5563').text(f.category);
    doc.moveDown(0.2);

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151').text('Localização: ', MARGIN + 4, doc.y, { continued: true })
      .font('Courier').fillColor('#1F2937').text(`${f.file}:${f.lines}`);
    doc.moveDown(0.3);

    // Bloco de código
    if (f.snippet) {
      doc.save();
      const snipY = doc.y;
      doc.fillColor(hexToRGB('#1E293B')).roundedRect(MARGIN + 4, snipY, CONTENT_W - 8, 36, 3).fill();
      doc.fontSize(6.5).font('Courier').fillColor('#E2E8F0')
        .text(f.snippet, MARGIN + 10, snipY + 5, { width: CONTENT_W - 20, lineBreak: true });
      doc.restore();
      doc.y = snipY + 40;
    }

    // Campos detalhados
    const details = [
      ['Fluxo de Dados:', f.flow],
      ['Por que é Vulnerável:', f.why],
      ['Quem Pode Explorar:', f.exploitability],
      ['Pré-condições:', f.preconditions],
      ['Impacto:', f.impact],
      ['Controles Considerados:', f.controlsConsidered],
      ['Recomendação:', f.recommendation]
    ];

    details.forEach(([lbl, val]) => {
      ensureSpace(doc, 22);
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#1F2937').text(lbl, MARGIN + 4, doc.y, { width: 110, lineBreak: false });
      doc.font('Helvetica').fillColor('#4B5563').text(val, MARGIN + 120, doc.y, { width: CONTENT_W - 124, lineGap: 1 });
      doc.moveDown(0.2);
    });

    doc.moveDown(0.8);
    doc.save();
    doc.strokeColor('#E5E7EB').lineWidth(0.5).moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).stroke();
    doc.restore();
    doc.moveDown(0.8);
  });

  // ══════════════════════════════════════════════════════════════
  // PÁGINA — RECOMENDAÇÕES PRIORIZADAS
  // ══════════════════════════════════════════════════════════════
  ensureSpace(doc, 140);
  doc.addPage();
  doc.y = MARGIN + 10;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#111418').text('Plano de Recomendações Priorizadas', MARGIN, doc.y);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + 300, doc.y + 2).strokeColor('#136DEC').lineWidth(2).stroke();
  doc.moveDown(1);

  recommendations.forEach(r => {
    ensureSpace(doc, 32);
    const rY = doc.y;
    const pColor = r.priority === 'P1' ? '#B91C1C' : r.priority === 'P2' ? '#EA580C' : '#2563EB';

    doc.save();
    doc.fillColor(hexToRGB(pColor)).roundedRect(MARGIN, rY, 24, 18, 3).fill();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF').text(r.priority, MARGIN + 4, rY + 5, { width: 16, align: 'center' });
    doc.restore();

    doc.fontSize(8).font('Helvetica').fillColor('#1F2937')
      .text(r.text, MARGIN + 32, rY + 3, { width: CONTENT_W - 36, lineGap: 2 });

    doc.y = rY + 26;
  });

  // ══════════════════════════════════════════════════════════════
  // PÁGINA — ISSUES PARA O GITHUB
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  doc.y = MARGIN + 10;

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#111418').text('Issues para o GitHub', MARGIN, doc.y);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + 180, doc.y + 2).strokeColor('#136DEC').lineWidth(2).stroke();
  doc.moveDown(0.6);

  doc.fontSize(7.5).font('Helvetica').fillColor('#4B5563')
    .text('As issues abaixo estão completas e delimitadas no formato Markdown pronto para cópia e abertura no repositório.', MARGIN);
  doc.moveDown(0.8);

  issues.forEach((iss, idx) => {
    ensureSpace(doc, 190);

    const issueHeaderY = doc.y;
    doc.save();
    doc.fillColor(hexToRGB('#EFF6FF')).strokeColor(hexToRGB('#BFDBFE')).lineWidth(0.5)
      .roundedRect(MARGIN, issueHeaderY, CONTENT_W, 20, 3).fillAndStroke();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1E40AF')
      .text(`--- ISSUE ${idx + 1} ---`, MARGIN + 8, issueHeaderY + 5, { lineBreak: false });
    doc.restore();

    doc.y = issueHeaderY + 26;

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#111418')
      .text(`Título: ${iss.title}`, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.2);

    doc.fontSize(7.5).font('Helvetica').fillColor('#6B7280')
      .text(`Labels sugeridas: ${iss.labels}`, MARGIN + 4, doc.y);
    doc.moveDown(0.3);

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151').text('Descrição:');
    doc.fontSize(7).font('Helvetica').fillColor('#4B5563').text(iss.description, MARGIN + 4, doc.y, { width: CONTENT_W - 8, lineGap: 1.5 });
    doc.moveDown(0.3);

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151').text('Por que é explorável:');
    doc.fontSize(7).font('Helvetica').fillColor('#4B5563').text(iss.why, MARGIN + 4, doc.y, { width: CONTENT_W - 8, lineGap: 1.5 });
    doc.moveDown(0.3);

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151').text('Evidência / Código:');
    doc.fontSize(6.5).font('Courier').fillColor('#1F2937').text(iss.evidence, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.3);

    if (iss.snippet) {
      doc.save();
      const sY = doc.y;
      doc.fillColor(hexToRGB('#F3F4F6')).roundedRect(MARGIN + 4, sY, CONTENT_W - 8, 30, 2).fill();
      doc.fontSize(6).font('Courier').fillColor('#1E293B').text(iss.snippet, MARGIN + 8, sY + 4, { width: CONTENT_W - 16 });
      doc.restore();
      doc.y = sY + 34;
    }

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151').text('Impacto:');
    doc.fontSize(7).font('Helvetica').fillColor('#4B5563').text(iss.impact, MARGIN + 4, doc.y, { width: CONTENT_W - 8, lineGap: 1.5 });
    doc.moveDown(0.3);

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151').text('Sugestão de Correção:');
    doc.fontSize(7).font('Helvetica').fillColor('#4B5563').text(iss.fix, MARGIN + 4, doc.y, { width: CONTENT_W - 8, lineGap: 1.5 });
    doc.moveDown(0.3);

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151').text('Critérios de Aceite Verificáveis:');
    doc.fontSize(6.5).font('Courier').fillColor('#1F2937').text(iss.acceptance, MARGIN + 4, doc.y, { width: CONTENT_W - 8, lineGap: 1.5 });
    doc.moveDown(0.4);

    doc.save();
    doc.fillColor(hexToRGB('#EFF6FF')).strokeColor(hexToRGB('#BFDBFE')).lineWidth(0.5)
      .roundedRect(MARGIN, doc.y, CONTENT_W, 16, 3).fillAndStroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1E40AF')
      .text(`--- FIM ISSUE ${idx + 1} ---`, MARGIN + 8, doc.y + 4, { lineBreak: false });
    doc.restore();

    doc.y += 24;
  });

  // Cabeçalhos e Rodapés com numeração total
  addHeaderFooter(doc);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      const stats = fs.statSync(outputPath);
      const totalPages = doc.bufferedPageRange().count;
      console.log(`✅ PDF gerado com sucesso: ${outputPath}`);
      console.log(`   Páginas: ${totalPages}`);
      console.log(`   Tamanho: ${(stats.size / 1024).toFixed(1)} KB`);
      resolve({ outputPath, totalPages, size: stats.size });
    });
    stream.on('error', reject);
  });
}

generatePDF().catch(err => {
  console.error('❌ Erro ao gerar PDF:', err);
  process.exit(1);
});
