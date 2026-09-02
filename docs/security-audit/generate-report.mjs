/**
 * Gerador de Relatório de Auditoria de Segurança — Horium
 * Dependência: pdfkit (npm install pdfkit)
 * Uso: node generate-report.mjs
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── PALETTE ────────────────────────────────────────────────
const SEV = {
  critica:      { color: '#B91C1C', label: 'Crítica' },
  alta:         { color: '#EA580C', label: 'Alta' },
  media:        { color: '#D97706', label: 'Média' },
  baixa:        { color: '#2563EB', label: 'Baixa' },
  informativa:  { color: '#6B7280', label: 'Informativa' },
  ponto_forte:  { color: '#059669', label: 'Ponto Forte' },
};

const MARGIN = 56; // ~2cm
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// ─── DADOS DA AUDITORIA ──────────────────────────────────────
const PROJECT_NAME = 'Horium';
const AUDIT_DATE = '01/09/2026';

const findings = [
  // CATEGORIA 1 — BANCO SEM TRANCA
  {
    id: 'F01',
    category: '1. Banco sem Tranca (RLS)',
    severity: 'alta',
    file: 'services/adminLicenseService.ts',
    lines: '144-158',
    snippet: `async getPendingLicensesCount(): Promise<number> {
  const { count, error } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .or('payment_status.eq.Aguardando,payment_status.eq.under_review');
  ...
  return count || 0;
}`,
    description: 'Contagem de licenças pendentes sem filtro de admin — qualquer usuário autenticado pode consultar.',
    why: 'O RPC get_pending_licenses_count_rpc (que valida admin) não é usado aqui. Em vez disso, a query direta na tabela licenses é feita com a anon key. A tabela licenses tem RLS que permite SELECT ao dono (user_id = auth.uid()) OU admin. Portanto, um usuário comum só verá as SUAS licenças pendentes — mas o método pretende retornar o TOTAL global para o admin. O resultado é incorreto para admin (sub-contagem) e revela ao usuário comum a contagem de suas próprias licenças pendentes (risco baixo). A falha é funcional (bypass da RPC segura).',
    exploitability: 'O RLS da tabela limita o impacto: usuários comuns verão apenas suas próprias licenças. Porém, a RPC segura é ignorada, criando dependência frágil no RLS.',
  },
  {
    id: 'F02',
    category: '1. Banco sem Tranca (RLS)',
    severity: 'media',
    file: 'services/ticketService.ts',
    lines: '36-40',
    snippet: `const { data } = supabase.storage
  .from('tickets-attachments')
  .getPublicUrl(filePath);
imageUrl = data.publicUrl;`,
    description: 'URL pública gerada para bucket PRIVADO — getPublicUrl() gera URL que não funciona para buckets privados, mas o valor é salvo na tabela.',
    why: 'O bucket tickets-attachments é privado (public=false). A URL gerada por getPublicUrl() não vai funcionar para renderização, mas o padrão é inconsistente: deveria usar createSignedUrl() ou o fluxo de download autenticado. A URL salva na tabela pode ser tentada por qualquer um (embora retorne 403).',
    exploitability: 'Impacto funcional mais que de segurança: imagens de tickets não serão visíveis. A URL salva não permite acesso real ao arquivo.',
  },
  {
    id: 'F03',
    category: '1. Banco sem Tranca (RLS)',
    severity: 'media',
    file: 'pages/PlansPage.tsx',
    lines: '146-149',
    snippet: `const { data: publicUrlData } = supabase.storage
  .from('receipts')
  .getPublicUrl(filePath);
receiptUrl = publicUrlData?.publicUrl || null;`,
    description: 'Mesmo problema de getPublicUrl() em bucket privado para comprovantes de pagamento (receipts).',
    why: 'Idem ao F02 — o bucket receipts é privado, mas a URL pública é gerada e salva na tabela licenses.receipt_url. Admins que tentarem visualizar o comprovante verão uma URL inválida.',
    exploitability: 'Idem ao F02. Risco funcional, não de exposição de dados.',
  },

  // CATEGORIA 2 — PERMISSÃO DEFINIDA NO NAVEGADOR
  {
    id: 'F04',
    category: '2. Permissão no Navegador',
    severity: 'critica',
    file: 'components/Layout.tsx + App.tsx',
    lines: 'Layout:66,180 / App:438-439',
    snippet: `// Layout.tsx:66
setIsAdmin(ADMIN_EMAILS.includes(user.email || ''));
// Layout.tsx:180 — Renderiza botão Admin apenas se isAdmin
{isAdmin && (<button onClick={() => setView(AppView.ADMIN)}>...)}
// App.tsx:438 — Renderiza AdminPanelPage
case AppView.ADMIN:
  return <AdminPanelPage ... />;`,
    description: 'O gate de acesso à área administrativa é EXCLUSIVAMENTE no frontend (lista hardcoded de e-mails). Qualquer usuário autenticado pode navegar diretamente para a view ADMIN manipulando o estado.',
    why: 'A proteção REAL está nas RPCs do banco (get_admin_licenses, approve_license_rpc, delete_license_rpc) que verificam is_admin(). Então as OPERAÇÕES são protegidas no banco, mas a VISUALIZAÇÃO da interface admin é controlada apenas no frontend. Um atacante autenticado pode montar o componente AdminPanelPage, que tentará chamar as RPCs — e falhará. Porém, a tentativa revela a existência das RPCs e sua API.',
    exploitability: 'Impacto reduzido porque as RPCs do banco validam admin. Porém, é má prática: o frontend expõe a UI e pode revelar informações pela tentativa de chamada.',
  },
  {
    id: 'F05',
    category: '2. Permissão no Navegador',
    severity: 'alta',
    file: 'services/adminLicenseService.ts',
    lines: '56-101',
    snippet: `// Fallback direto via cliente caso a RPC ainda não exista
const { error } = await supabase
  .from('licenses')
  .update({
    payment_status: 'Aprovado',
    valid_until: validUntilDate
  })
  .eq('id', licenseId);`,
    description: 'Fallback client-side no approveLicense() permite que, se a RPC falhar (por qualquer motivo), a aprovação seja tentada diretamente via query na tabela licenses.',
    why: 'A tabela licenses tem RLS que permite ALL para admin E SELECT/INSERT para o próprio usuário. O UPDATE direto falhará para não-admins graças ao RLS. MAS o padrão é perigoso: se o RLS for relaxado no futuro, ou se o fallback for copiado para outro contexto, o bypass se torna real. Além disso, o fallback faz operações parciais (update sem atualizar schedule nem criar notificação) — risco de inconsistência.',
    exploitability: 'Atualmente bloqueado pelo RLS. Risco latente que se materializa se o RLS for alterado ou se o padrão for reutilizado.',
  },
  {
    id: 'F06',
    category: '2. Permissão no Navegador',
    severity: 'alta',
    file: 'services/adminLicenseService.ts',
    lines: '113-138',
    snippet: `// deleteLicense — fallback direto
const { error } = await supabase
  .from('licenses')
  .delete()
  .eq('id', licenseId);`,
    description: 'Mesmo padrão de fallback client-side no deleteLicense(). Se a RPC delete_license_rpc falhar, a exclusão é tentada diretamente.',
    why: 'Idem ao F05. O RLS protege atualmente, mas o padrão de fallback é inseguro por design.',
    exploitability: 'Idem ao F05. RLS protege, mas o fallback é anti-padrão.',
  },

  // CATEGORIA 3 — IDOR
  {
    id: 'F07',
    category: '3. IDOR',
    severity: 'media',
    file: 'services/scheduleService.ts',
    lines: '180-190',
    snippet: `async deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
}`,
    description: 'Soft-delete de schedule por ID sem filtro explícito de user_id no código do serviço.',
    why: 'A proteção está no RLS da tabela schedules (UPDATE permitido apenas se auth.uid() = user_id OR is_admin()). O RLS garante que um usuário não consiga soft-deletar o schedule de outro. Contudo, o código não filtra explicitamente, dependendo 100% do RLS.',
    exploitability: 'Protegido pelo RLS. Se o RLS for desabilitado ou alterado, se torna IDOR.',
  },
  {
    id: 'F08',
    category: '3. IDOR',
    severity: 'media',
    file: 'services/scheduleService.ts',
    lines: '221-231',
    snippet: `async restoreSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({ deleted_at: null })
    .eq('id', id);
}`,
    description: 'Restauração de schedule por ID sem filtro explícito de user_id.',
    why: 'Idem ao F07. RLS protege.',
    exploitability: 'Idem ao F07.',
  },
  {
    id: 'F09',
    category: '3. IDOR',
    severity: 'media',
    file: 'services/scheduleService.ts',
    lines: '233-243',
    snippet: `async permanentlyDeleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id);
}`,
    description: 'Exclusão permanente de schedule por ID sem filtro explícito de user_id.',
    why: 'RLS da tabela schedules permite DELETE apenas se auth.uid() = user_id OR is_admin().',
    exploitability: 'Protegido pelo RLS.',
  },
  {
    id: 'F10',
    category: '3. IDOR',
    severity: 'media',
    file: 'services/notificationService.ts',
    lines: '45-56',
    snippet: `async markAsRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}`,
    description: 'Marcar notificação como lida por ID sem filtro de user_id.',
    why: 'O RLS de notifications permite UPDATE se auth.uid() = user_id OR is_admin(). Porém, a operação é de baixo impacto (marcar como lida).',
    exploitability: 'Protegido pelo RLS. Impacto mínimo mesmo sem RLS.',
  },

  // CATEGORIA 4 — CHAVES EXPOSTAS
  {
    id: 'F11',
    category: '4. Chaves Expostas',
    severity: 'critica',
    file: '.env.local',
    lines: '1',
    snippet: `GEMINI_API_KEY=AIzaSy[REDACTED]`,
    description: 'Chave de API do Google Gemini armazenada em .env.local. Embora o .env.local não esteja rastreado pelo git (*.local no .gitignore), a chave foi encontrada no histórico git (commits ff8a553 e c34535d).',
    why: 'A chave AIzaSy... é uma chave de API do Google (Gemini). Ela foi commitada em versões anteriores do projeto e PERMANECE no histórico git. Qualquer pessoa com acesso ao repositório pode extraí-la. Além disso, a chave não é usada em nenhum lugar do código atual — pode ser um resquício, mas permanece exposta.',
    exploitability: 'Qualquer pessoa com acesso ao repositório git pode extrair a chave do histórico e usá-la para fazer chamadas à API do Google, gerando custos ao proprietário.',
  },
  {
    id: 'F12',
    category: '4. Chaves Expostas',
    severity: 'informativa',
    file: 'services/supabaseClient.ts',
    lines: '3-4',
    snippet: `const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;`,
    description: 'A Supabase Anon Key e URL são expostas no bundle do frontend (prefixo VITE_). Isso é o design intencional do Supabase (anon key é pública por definição), mas a segurança DEPENDE inteiramente do RLS estar corretamente configurado.',
    why: 'É esperado que a anon key do Supabase seja pública. A segurança real está nas políticas RLS. Este achado é informativo para reforçar a importância do RLS.',
    exploitability: 'Esperado e por design. Não é uma vulnerabilidade se o RLS estiver bem configurado.',
  },
  {
    id: 'F13',
    category: '4. Chaves Expostas',
    severity: 'alta',
    file: 'schema.sql',
    lines: '9',
    snippet: `RETURN (auth.jwt() ->> 'email') IN ('horium.app@gmail.com', 'prof.jackison@gmail.com');`,
    description: 'E-mails de administradores hardcoded na função is_admin() do banco de dados e no frontend (types.ts:14).',
    why: 'Os e-mails dos administradores estão hardcoded tanto no banco (schema.sql:9) quanto no frontend (types.ts:14). Isso não é um segredo em si, mas: (1) dificulta a gestão de admins — adicionar/remover exige deploy do banco E do frontend; (2) expõe a identidade dos administradores no código-fonte público.',
    exploitability: 'Facilita ataques de engenharia social direcionados aos e-mails administrativos. Gestão inflexível de privilégios.',
  },

  // CATEGORIA 5 — INPUTS SEM TRATAMENTO (XSS)
  // Nenhuma vulnerabilidade encontrada nesta categoria
];

const strengths = [
  {
    id: 'S01',
    description: 'RLS ativo em TODAS as tabelas — schedules, licenses, notifications, tickets têm Row Level Security habilitado com políticas corretas que filtram por auth.uid() = user_id.',
    evidence: 'schema.sql:27 (schedules), 84 (licenses), 121 (notifications), 148 (tickets)',
  },
  {
    id: 'S02',
    description: 'RPCs administrativas com SECURITY DEFINER e validação is_admin() — get_admin_licenses, approve_license_rpc, delete_license_rpc, get_pending_licenses_count_rpc todas verificam is_admin() antes de executar.',
    evidence: 'schema.sql:166-283',
  },
  {
    id: 'S03',
    description: 'Trigger de proteção contra manipulação de is_licensed — protect_schedule_license_status() impede que não-admins alterem o campo is_licensed diretamente.',
    evidence: 'schema.sql:47-65',
  },
  {
    id: 'S04',
    description: 'Storage buckets PRIVADOS com RLS — receipts e tickets-attachments são privados (public=false) com políticas de isolamento por user_id via storage.foldername().',
    evidence: 'schema.sql:286-334',
  },
  {
    id: 'S05',
    description: 'Autenticação via Supabase Auth — fluxo de sign-up com verificação por OTP, reset de senha via link, persistência de sessão com auto-refresh.',
    evidence: 'services/authService.ts (todo o arquivo)',
  },
  {
    id: 'S06',
    description: 'Sem XSS: React impede innerHTML por default — o codebase não utiliza dangerouslySetInnerHTML, innerHTML, v-html, eval() ou new Function() em NENHUM arquivo.',
    evidence: 'Busca grep em todo o projeto retornou 0 resultados para todos os padrões XSS.',
  },
  {
    id: 'S07',
    description: '.env.local no .gitignore — o arquivo de variáveis de ambiente local está excluído do rastreamento git via padrão *.local.',
    evidence: '.gitignore:13',
  },
  {
    id: 'S08',
    description: 'Validação de insert em licenses — RLS permite INSERT apenas com payment_status IN (\'Aguardando\', \'under_review\') ou NULL, impedindo que usuários criem licenças já aprovadas.',
    evidence: 'schema.sql:101-107',
  },
  {
    id: 'S09',
    description: 'Upload de arquivos com sanitização de extensão — extensões são limpas com regex (remove caracteres não alfanuméricos) e limitadas a 5 caracteres.',
    evidence: 'services/ticketService.ts:21-22, pages/PlansPage.tsx:132-133',
  },
  {
    id: 'S10',
    description: 'Headers de segurança no index.html — X-Content-Type-Options: nosniff e referrer policy strict-origin-when-cross-origin.',
    evidence: 'index.html:7-8',
  },
];

const recommendations = [
  { priority: 'P1', text: 'Revogar a chave Gemini API (AIzaSy...) exposta no histórico git e gerar uma nova. Considerar reescrever o histórico git ou tornar o repositório privado.' },
  { priority: 'P1', text: 'Remover TODOS os fallbacks client-side das operações admin (approveLicense, deleteLicense). Se a RPC falhar, deve falhar — não tentar bypass.' },
  { priority: 'P2', text: 'Mover e-mails de admin para variáveis de ambiente ou tabela no banco com RLS, removendo do código-fonte.' },
  { priority: 'P2', text: 'Substituir getPublicUrl() por createSignedUrl() nos buckets privados (receipts e tickets-attachments).' },
  { priority: 'P2', text: 'Adicionar filtro explícito de user_id nas queries do frontend (deleteSchedule, restoreSchedule, permanentlyDeleteSchedule, markAsRead) como defesa em profundidade, mesmo com RLS ativo.' },
  { priority: 'P2', text: 'Usar a RPC get_pending_licenses_count_rpc no getPendingLicensesCount() em vez da query direta.' },
  { priority: 'P3', text: 'Adicionar validação de startup que rejeite valores padrão inseguros para variáveis de ambiente (ex: lançar erro se VITE_SUPABASE_URL estiver vazio).' },
  { priority: 'P3', text: 'Implementar rate limiting nas RPCs administrativas para evitar abuso.' },
];

const issues = [
  {
    title: '[Segurança] Chave Gemini API exposta no histórico git',
    labels: 'security, critica',
    description: 'A chave de API do Google Gemini (`AIzaSy[REDACTED]`) está presente no histórico git do repositório (commits ff8a553 e c34535d). Mesmo não estando no branch atual (.env.local está no .gitignore), qualquer pessoa com acesso ao repositório pode extraí-la.',
    evidence: '`.env.local:1` — `GEMINI_API_KEY=AIzaSy[REDACTED]`\nHistórico git: `git log --all -S "AIzaSy" --oneline` retorna commits ff8a553 e c34535d.',
    impact: 'Uso não autorizado da API Gemini, gerando custos financeiros ao proprietário da chave.',
    fix: '1. Revogar a chave imediatamente no Google Cloud Console\n2. Gerar uma nova chave\n3. Considerar `git filter-branch` ou `BFG Repo-Cleaner` para limpar o histórico\n4. Verificar se o repositório é público; se sim, tratar como comprometida',
    acceptance: '- [ ] Chave antiga revogada no Google Cloud Console\n- [ ] Nova chave gerada e configurada apenas em .env.local\n- [ ] Histórico git limpo OU repositório marcado como privado\n- [ ] Nenhuma chave sensível aparece em `git log --all -S "AIzaSy"`',
  },
  {
    title: '[Segurança] Remover fallbacks client-side das operações admin',
    labels: 'security, alta',
    description: 'Os métodos `approveLicense()` e `deleteLicense()` em `adminLicenseService.ts` contêm fallbacks que tentam operações diretamente na tabela `licenses` quando as RPCs seguras falham. Embora o RLS atualmente bloqueie não-admins, o padrão é inseguro por design e cria dependência frágil.',
    evidence: '`services/adminLicenseService.ts:56-101` (approveLicense fallback)\n`services/adminLicenseService.ts:124-134` (deleteLicense fallback)',
    impact: 'Se o RLS for relaxado no futuro, qualquer usuário autenticado poderia aprovar ou excluir licenças. O fallback também causa inconsistência (não cria notificação nem atualiza schedules).',
    fix: '1. Remover os blocos de fallback client-side\n2. Se a RPC falhar, propagar o erro ao usuário\n3. Garantir que as RPCs estão deployed no Supabase',
    acceptance: '- [ ] Nenhum fallback client-side para operações de admin em `adminLicenseService.ts`\n- [ ] Erro da RPC é exibido ao admin quando falha\n- [ ] RPCs `approve_license_rpc` e `delete_license_rpc` verificadas como deployed',
  },
  {
    title: '[Segurança] E-mails de admin hardcoded no código-fonte e no banco',
    labels: 'security, alta',
    description: 'Os e-mails dos administradores estão hardcoded em `schema.sql:9` (função `is_admin()`) e em `types.ts:14` (`ADMIN_EMAILS`). Isso expõe a identidade dos admins e dificulta a gestão de privilégios.',
    evidence: '`schema.sql:9` — `RETURN (auth.jwt() ->> \'email\') IN (\'horium.app@gmail.com\', \'prof.jackison@gmail.com\');`\n`types.ts:14` — `export const ADMIN_EMAILS = [\'horium.app@gmail.com\', \'prof.jackison@gmail.com\'];`',
    impact: 'Exposição de identidade administrativa. Gestão inflexível — requer deploy para adicionar/remover admin.',
    fix: '1. Criar tabela `admin_users` com RLS\n2. Alterar `is_admin()` para consultar a tabela\n3. No frontend, consultar uma RPC que retorne se o usuário é admin',
    acceptance: '- [ ] Nenhum e-mail hardcoded no código-fonte\n- [ ] Função `is_admin()` consulta tabela dinâmica\n- [ ] Frontend usa RPC para verificar papel',
  },
  {
    title: '[Segurança] Uso de getPublicUrl() em buckets privados',
    labels: 'security, media',
    description: 'Os métodos de upload de comprovantes (`PlansPage.tsx:146-149`) e tickets (`ticketService.ts:36-40`) usam `getPublicUrl()` para gerar URLs de arquivos em buckets privados. As URLs geradas não funcionam para buckets privados.',
    evidence: '`services/ticketService.ts:36-40`\n`pages/PlansPage.tsx:146-149`\n`components/licenses/LicensePurchase.tsx:103`',
    impact: 'Comprovantes e anexos de tickets não são visualizáveis. Funcionalidade quebrada.',
    fix: '1. Substituir `getPublicUrl()` por `createSignedUrl()` com expiração\n2. Ou salvar apenas o path relativo e gerar signed URL sob demanda na visualização',
    acceptance: '- [ ] Nenhum uso de `getPublicUrl()` em buckets privados\n- [ ] Comprovantes e anexos são visualizáveis pelos destinatários corretos\n- [ ] URLs têm expiração definida',
  },
  {
    title: '[Segurança] Defesa em profundidade: adicionar filtro user_id nas queries do frontend',
    labels: 'security, media',
    description: 'Várias operações em `scheduleService.ts` e `notificationService.ts` dependem exclusivamente do RLS para isolamento, sem filtrar por `user_id` no código. Embora o RLS proteja, a defesa em profundidade recomenda filtro duplo.',
    evidence: '`scheduleService.ts:180-190` (deleteSchedule)\n`scheduleService.ts:221-231` (restoreSchedule)\n`scheduleService.ts:233-243` (permanentlyDeleteSchedule)\n`notificationService.ts:45-56` (markAsRead)',
    impact: 'Se o RLS for desabilitado ou alterado incorretamente, as operações se tornam IDOR.',
    fix: 'Adicionar `.eq(\'user_id\', user.id)` em todas as queries que operam por ID em tabelas com dados multi-tenant.',
    acceptance: '- [ ] Todas as queries de mutação filtram por user_id além do ID do recurso\n- [ ] Testes confirmam que queries retornam erro se user_id não corresponde',
  },
  {
    title: '[Segurança] Usar RPC segura para contagem de licenças pendentes',
    labels: 'security, alta',
    description: 'O método `getPendingLicensesCount()` em `adminLicenseService.ts:144-158` faz query direta na tabela `licenses` em vez de usar a RPC `get_pending_licenses_count_rpc` que valida admin.',
    evidence: '`services/adminLicenseService.ts:144-158`',
    impact: 'Bypass da RPC segura. Resultado incorreto para admins (sub-contagem por causa do RLS).',
    fix: 'Substituir a query direta pela chamada `supabase.rpc(\'get_pending_licenses_count_rpc\')`.',
    acceptance: '- [ ] `getPendingLicensesCount()` usa a RPC `get_pending_licenses_count_rpc`\n- [ ] Contagem retorna o total global para admins',
  },
];

// ─── PDF GENERATION ─────────────────────────────────────────

function hexToRGB(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function createDoc() {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: `Relatório de Auditoria de Segurança — ${PROJECT_NAME}`,
      Author: 'Auditoria Automatizada',
      Subject: 'Segurança da Aplicação',
    }
  });
  return doc;
}

function addHeaderFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    // Header
    doc.save();
    doc.fontSize(7).fillColor('#9CA3AF')
      .text(`Relatório de Auditoria de Segurança — ${PROJECT_NAME}`, MARGIN, 20, { width: CONTENT_W, align: 'left' });
    // Footer
    doc.fontSize(7).fillColor('#9CA3AF')
      .text(`Página ${i + 1} de ${pages.count}`, MARGIN, PAGE_H - 30, { width: CONTENT_W, align: 'center' });
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

    // Draw arc using small line segments
    doc.save();
    doc.fillColor(rgb);

    const steps = Math.max(20, Math.ceil(sliceAngle * 30));
    const angleStep = sliceAngle / steps;

    // Build path
    let pathStr = '';
    // Start at outer arc start
    const ox1 = x + radius * Math.cos(startAngle);
    const oy1 = y + radius * Math.sin(startAngle);
    doc.moveTo(ox1, oy1);

    // Outer arc
    for (let i = 0; i <= steps; i++) {
      const a = startAngle + i * angleStep;
      const px = x + radius * Math.cos(a);
      const py = y + radius * Math.sin(a);
      doc.lineTo(px, py);
    }

    // Line to inner arc end
    const ix2 = x + innerRadius * Math.cos(endAngle);
    const iy2 = y + innerRadius * Math.sin(endAngle);
    doc.lineTo(ix2, iy2);

    // Inner arc (reverse)
    for (let i = steps; i >= 0; i--) {
      const a = startAngle + i * angleStep;
      const px = x + innerRadius * Math.cos(a);
      const py = y + innerRadius * Math.sin(a);
      doc.lineTo(px, py);
    }

    doc.closePath();
    doc.fill();
    doc.restore();

    startAngle = endAngle;
  });

  // Center text
  doc.save();
  doc.fontSize(16).fillColor('#111418').font('Helvetica-Bold');
  const totalStr = String(total);
  const tw = doc.widthOfString(totalStr);
  doc.text(totalStr, x - tw / 2, y - 8, { lineBreak: false });
  doc.fontSize(7).fillColor('#6B7280').font('Helvetica');
  const label = 'achados';
  const lw = doc.widthOfString(label);
  doc.text(label, x - lw / 2, y + 8, { lineBreak: false });
  doc.restore();
}

function drawBarChart(doc, x, y, width, height, data) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.min(40, (width - 20) / data.length - 8);
  const gap = (width - data.length * barWidth) / (data.length + 1);

  // Background grid
  doc.save();
  doc.strokeColor('#E5E7EB').lineWidth(0.5);
  for (let i = 0; i <= 4; i++) {
    const gy = y + height - (height * i / 4);
    doc.moveTo(x, gy).lineTo(x + width, gy).stroke();
  }
  doc.restore();

  data.forEach((d, i) => {
    if (d.value === 0) return;
    const barH = (d.value / maxVal) * (height - 20);
    const bx = x + gap + i * (barWidth + gap);
    const by = y + height - barH;
    const rgb = hexToRGB(d.color);

    // Bar with rounded top
    doc.save();
    doc.fillColor(rgb);
    doc.roundedRect(bx, by, barWidth, barH, 3).fill();
    doc.restore();

    // Value label
    doc.save();
    doc.fontSize(8).fillColor('#374151').font('Helvetica-Bold');
    const vStr = String(d.value);
    const vw = doc.widthOfString(vStr);
    doc.text(vStr, bx + barWidth / 2 - vw / 2, by - 12, { lineBreak: false });
    doc.restore();

    // Category label
    doc.save();
    doc.fontSize(5.5).fillColor('#6B7280').font('Helvetica');
    const cStr = d.label.length > 12 ? d.label.substring(0, 12) + '…' : d.label;
    const cw = doc.widthOfString(cStr);
    doc.text(cStr, bx + barWidth / 2 - cw / 2, y + height + 4, { lineBreak: false });
    doc.restore();
  });
}

function drawSeverityBadge(doc, x, y, severity) {
  const sev = SEV[severity] || SEV.informativa;
  const rgb = hexToRGB(sev.color);
  const label = sev.label.toUpperCase();
  const fontSize = 6.5;
  doc.save();
  doc.fontSize(fontSize).font('Helvetica-Bold');
  const tw = doc.widthOfString(label);
  const badgeW = tw + 10;
  const badgeH = 14;
  doc.fillColor(rgb).roundedRect(x, y, badgeW, badgeH, 3).fill();
  doc.fillColor('#FFFFFF').text(label, x + 5, y + 3, { lineBreak: false });
  doc.restore();
  return badgeW;
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > PAGE_H - MARGIN - 20) {
    doc.addPage();
  }
}

async function generatePDF() {
  const outputPath = path.join(__dirname, 'relatorio-auditoria-seguranca.pdf');
  const doc = createDoc();
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // ═══ COVER PAGE ═══
  doc.save();
  // Top accent bar
  doc.fillColor(hexToRGB('#136DEC')).rect(0, 0, PAGE_W, 8).fill();
  doc.restore();

  doc.moveDown(6);
  doc.fontSize(28).font('Helvetica-Bold').fillColor('#111418')
    .text('Relatório de Auditoria', MARGIN, doc.y, { width: CONTENT_W, align: 'center' });
  doc.fontSize(28).font('Helvetica-Bold').fillColor('#136DEC')
    .text('de Segurança', { width: CONTENT_W, align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(18).font('Helvetica').fillColor('#6B7280')
    .text(PROJECT_NAME, { width: CONTENT_W, align: 'center' });

  doc.moveDown(3);
  // Info box
  const boxY = doc.y;
  doc.save();
  doc.fillColor(hexToRGB('#F3F4F6')).roundedRect(MARGIN + 60, boxY, CONTENT_W - 120, 160, 8).fill();
  doc.restore();

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151');
  const infoX = MARGIN + 80;
  let infoY = boxY + 20;
  const lineH = 22;

  doc.text('Data:', infoX, infoY, { continued: true }).font('Helvetica').text(`  ${AUDIT_DATE}`);
  infoY += lineH;
  doc.font('Helvetica-Bold').text('Escopo:', infoX, infoY, { continued: true }).font('Helvetica').text('  Código-fonte completo (frontend + schema SQL)');
  infoY += lineH;
  doc.font('Helvetica-Bold').text('Stack:', infoX, infoY, { continued: true }).font('Helvetica').text('  React 19 + Vite + Supabase (PostgreSQL + Auth + Storage)');
  infoY += lineH;
  doc.font('Helvetica-Bold').text('Backend:', infoX, infoY, { continued: true }).font('Helvetica').text('  Supabase RLS + RPCs (SECURITY DEFINER)');
  infoY += lineH;
  doc.font('Helvetica-Bold').text('Frontend:', infoX, infoY, { continued: true }).font('Helvetica').text('  React SPA (TypeScript) com TailwindCSS');
  infoY += lineH;
  doc.font('Helvetica-Bold').text('Deploy:', infoX, infoY, { continued: true }).font('Helvetica').text('  Sem Docker/CI/Helm/Terraform detectados');

  doc.moveDown(8);
  doc.fontSize(8).font('Helvetica').fillColor('#9CA3AF')
    .text('Nota Metodológica: Cada categoria de auditoria foi mapeada para a stack Supabase — "Banco sem Tranca" = RLS ausente/furado; "Permissão no Navegador" = gate frontend sem validação na RPC; "IDOR" = queries sem filtro user_id; "Chaves Expostas" = segredos no código/git; "XSS" = padrões inseguros de renderização no React.', MARGIN, doc.y, { width: CONTENT_W, align: 'center' });

  // ═══ EXECUTIVE SUMMARY ═══
  doc.addPage();

  doc.fontSize(20).font('Helvetica-Bold').fillColor('#111418')
    .text('Resumo Executivo', MARGIN, MARGIN + 10);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + 160, doc.y + 2).strokeColor('#136DEC').lineWidth(2).stroke();
  doc.moveDown(1.5);

  // Severity counts
  const sevCounts = {
    critica: findings.filter(f => f.severity === 'critica').length,
    alta: findings.filter(f => f.severity === 'alta').length,
    media: findings.filter(f => f.severity === 'media').length,
    baixa: findings.filter(f => f.severity === 'baixa').length,
    informativa: findings.filter(f => f.severity === 'informativa').length,
  };

  // Summary cards
  const cardY = doc.y;
  const cardW = (CONTENT_W - 40) / 5;
  Object.entries(sevCounts).forEach(([sev, count], i) => {
    const cx = MARGIN + i * (cardW + 10);
    const rgb = hexToRGB(SEV[sev].color);
    doc.save();
    doc.fillColor(rgb).roundedRect(cx, cardY, cardW, 50, 6).fill();
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22)
      .text(String(count), cx + 8, cardY + 8, { lineBreak: false });
    doc.fillColor('#FFFFFF').font('Helvetica').fontSize(7)
      .text(SEV[sev].label.toUpperCase(), cx + 8, cardY + 34, { lineBreak: false });
    doc.restore();
  });

  doc.y = cardY + 70;
  doc.moveDown(0.5);

  // Charts
  const chartY = doc.y;
  // Donut
  const donutData = Object.entries(sevCounts)
    .filter(([_, v]) => v > 0)
    .map(([sev, value]) => ({ value, color: SEV[sev].color, label: SEV[sev].label }));

  drawDonutChart(doc, MARGIN + 100, chartY + 70, 60, donutData);

  // Donut legend
  let legendY = chartY + 10;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151')
    .text('Por Severidade', MARGIN + 20, legendY);
  legendY += 16;
  donutData.forEach(d => {
    doc.save();
    doc.fillColor(hexToRGB(d.color)).rect(MARGIN + 20, legendY, 8, 8).fill();
    doc.fillColor('#374151').font('Helvetica').fontSize(7)
      .text(`${d.label} (${d.value})`, MARGIN + 34, legendY, { lineBreak: false });
    doc.restore();
    legendY += 14;
  });

  // Bar chart - by category
  const categories = [
    { label: 'Banco s/ Tranca', value: findings.filter(f => f.category.startsWith('1.')).length, color: '#B91C1C' },
    { label: 'Perm. Browser', value: findings.filter(f => f.category.startsWith('2.')).length, color: '#EA580C' },
    { label: 'IDOR', value: findings.filter(f => f.category.startsWith('3.')).length, color: '#D97706' },
    { label: 'Chaves Exp.', value: findings.filter(f => f.category.startsWith('4.')).length, color: '#2563EB' },
    { label: 'XSS', value: 0, color: '#059669' },
  ];

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151')
    .text('Por Categoria', MARGIN + 260, chartY + 10);
  drawBarChart(doc, MARGIN + 260, chartY + 30, 200, 110, categories);

  doc.y = chartY + 170;

  // ═══ STRENGTHS & WEAKNESSES ═══
  doc.moveDown(1);
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#059669')
    .text('✓ Pontos Fortes', MARGIN);
  doc.moveDown(0.5);

  strengths.forEach(s => {
    ensureSpace(doc, 40);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#065F46')
      .text(`[${s.id}] ${s.description}`, MARGIN + 10, doc.y, { width: CONTENT_W - 20 });
    doc.fontSize(7).font('Helvetica').fillColor('#6B7280')
      .text(`Evidência: ${s.evidence}`, MARGIN + 10, doc.y, { width: CONTENT_W - 20 });
    doc.moveDown(0.3);
  });

  ensureSpace(doc, 60);
  doc.moveDown(1);
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#B91C1C')
    .text('✗ Pontos Fracos (Riscos Centrais)', MARGIN);
  doc.moveDown(0.5);

  const weaknesses = [
    'Chave de API Google Gemini comprometida no histórico git — exploração imediata possível.',
    'Padrão de fallback client-side em operações admin — dependência frágil no RLS.',
    'E-mails de admin hardcoded em código-fonte público — exposição de identidade.',
    'URLs públicas geradas para buckets privados — funcionalidade de visualização quebrada.',
    'Queries sem filtro explícito de user_id — dependência total no RLS para isolamento.',
  ];

  weaknesses.forEach((w, i) => {
    ensureSpace(doc, 20);
    doc.fontSize(8).font('Helvetica').fillColor('#991B1B')
      .text(`${i + 1}. ${w}`, MARGIN + 10, doc.y, { width: CONTENT_W - 20 });
    doc.moveDown(0.2);
  });

  // ═══ DETAILED FINDINGS TABLE ═══
  doc.addPage();
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#111418')
    .text('Achados Detalhados', MARGIN, MARGIN + 10);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + 160, doc.y + 2).strokeColor('#136DEC').lineWidth(2).stroke();
  doc.moveDown(1);

  let currentCategory = '';
  findings.forEach(f => {
    if (f.category !== currentCategory) {
      currentCategory = f.category;
      ensureSpace(doc, 40);
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1F2937')
        .text(currentCategory, MARGIN);
      doc.moveDown(0.3);
    }

    // Estimate space needed
    ensureSpace(doc, 100);

    // Finding card
    const cardTop = doc.y;
    doc.save();
    doc.fillColor(hexToRGB('#F9FAFB')).roundedRect(MARGIN, cardTop, CONTENT_W, 4, 2).fill();
    doc.restore();

    doc.y = cardTop + 6;

    // Severity badge + ID
    const badgeW = drawSeverityBadge(doc, MARGIN + 4, doc.y, f.severity);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1F2937')
      .text(`${f.id} — ${f.file}:${f.lines}`, MARGIN + badgeW + 12, doc.y + 2, { width: CONTENT_W - badgeW - 20, lineBreak: false });
    doc.y += 18;

    // Description
    doc.fontSize(8).font('Helvetica').fillColor('#374151')
      .text(f.description, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.2);

    // Why
    doc.fontSize(7).font('Helvetica').fillColor('#6B7280')
      .text(`Explorabilidade: ${f.exploitability}`, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.2);

    // Code snippet
    if (f.snippet) {
      doc.save();
      const snippetTop = doc.y;
      const snippetLines = f.snippet.split('\n').slice(0, 4).join('\n');
      doc.fontSize(6).font('Courier').fillColor('#1F2937');
      const snippetH = doc.heightOfString(snippetLines, { width: CONTENT_W - 24 }) + 10;
      doc.fillColor(hexToRGB('#F3F4F6')).roundedRect(MARGIN + 4, snippetTop, CONTENT_W - 8, snippetH, 3).fill();
      doc.fillColor('#1F2937').font('Courier').fontSize(6)
        .text(snippetLines, MARGIN + 12, snippetTop + 5, { width: CONTENT_W - 24 });
      doc.restore();
      doc.y = snippetTop + snippetH + 4;
    }

    // Separator
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.y += 6;
  });

  // ═══ RECOMMENDATIONS ═══
  ensureSpace(doc, 100);
  doc.addPage();
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#111418')
    .text('Recomendações Priorizadas', MARGIN, MARGIN + 10);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + 200, doc.y + 2).strokeColor('#136DEC').lineWidth(2).stroke();
  doc.moveDown(1);

  recommendations.forEach(r => {
    ensureSpace(doc, 30);
    const prioColor = r.priority === 'P1' ? '#B91C1C' : r.priority === 'P2' ? '#D97706' : '#2563EB';
    doc.save();
    doc.fontSize(8).font('Helvetica-Bold').fillColor(hexToRGB(prioColor))
      .text(`[${r.priority}]`, MARGIN, doc.y, { continued: true })
      .font('Helvetica').fillColor('#374151')
      .text(`  ${r.text}`, { width: CONTENT_W - 30 });
    doc.restore();
    doc.moveDown(0.5);
  });

  // ═══ GITHUB ISSUES ═══
  doc.addPage();
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#111418')
    .text('Issues para o GitHub', MARGIN, MARGIN + 10);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + 160, doc.y + 2).strokeColor('#136DEC').lineWidth(2).stroke();
  doc.moveDown(1);

  doc.fontSize(8).font('Helvetica').fillColor('#6B7280')
    .text('Abaixo estão as issues completas em formato Markdown, prontas para copiar e colar no GitHub.', MARGIN);
  doc.moveDown(1);

  issues.forEach((issue, idx) => {
    ensureSpace(doc, 180);

    // Issue header
    doc.save();
    doc.fillColor(hexToRGB('#EFF6FF')).roundedRect(MARGIN, doc.y, CONTENT_W, 22, 4).fill();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1E40AF')
      .text(`--- ISSUE ${idx + 1} ---`, MARGIN + 8, doc.y + 6, { lineBreak: false });
    doc.restore();
    doc.y += 28;

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#111418')
      .text(`Título: ${issue.title}`, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.3);

    doc.fontSize(7).font('Helvetica').fillColor('#6B7280')
      .text(`Labels: ${issue.labels}`, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.3);

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#374151')
      .text('Descrição:', MARGIN + 4);
    doc.fontSize(7).font('Helvetica').fillColor('#374151')
      .text(issue.description, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.3);

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#374151')
      .text('Evidência:', MARGIN + 4);
    doc.fontSize(6.5).font('Courier').fillColor('#1F2937')
      .text(issue.evidence, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.3);

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#374151')
      .text('Impacto:', MARGIN + 4);
    doc.fontSize(7).font('Helvetica').fillColor('#374151')
      .text(issue.impact, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.3);

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#374151')
      .text('Sugestão de Correção:', MARGIN + 4);
    doc.fontSize(7).font('Helvetica').fillColor('#374151')
      .text(issue.fix, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.3);

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#374151')
      .text('Critérios de Aceite:', MARGIN + 4);
    doc.fontSize(7).font('Helvetica').fillColor('#374151')
      .text(issue.acceptance, MARGIN + 4, doc.y, { width: CONTENT_W - 8 });
    doc.moveDown(0.3);

    // End marker
    doc.save();
    doc.fillColor(hexToRGB('#EFF6FF')).roundedRect(MARGIN, doc.y, CONTENT_W, 16, 4).fill();
    doc.fontSize(7).font('Helvetica').fillColor('#1E40AF')
      .text(`--- FIM ISSUE ${idx + 1} ---`, MARGIN + 8, doc.y + 4, { lineBreak: false });
    doc.restore();
    doc.y += 24;
  });

  // ═══ HEADERS/FOOTERS ═══
  addHeaderFooter(doc);

  // ═══ FINALIZE ═══
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      const stats = fs.statSync(outputPath);
      console.log(`✅ PDF gerado com sucesso: ${outputPath}`);
      console.log(`   Tamanho: ${(stats.size / 1024).toFixed(1)} KB`);
      resolve(outputPath);
    });
    stream.on('error', reject);
  });
}

generatePDF().catch(err => {
  console.error('❌ Erro ao gerar PDF:', err);
  process.exit(1);
});
