const SAFE_EXACT = new Set([
    'Usuário não autenticado.',
    'A grade especificada não pertence ao usuário autenticado.',
    'Caminho de comprovante inválido ou inseguro.',
    'Comprovante não encontrado no armazenamento do usuário.',
    'Caminho de anexo inválido ou inseguro.',
    'Horário não encontrado.',
    'Acesso negado.',
    'Status inválido. Deve ser aberto, em_andamento ou fechado.',
    'Acesso negado. Apenas administradores podem acessar esta função.',
    'Acesso negado. Apenas administradores podem aprovar licenças.',
    'Acesso negado. Apenas administradores podem rejeitar licenças.',
    'Acesso negado. Apenas administradores podem excluir licenças.',
    'Acesso negado. Apenas administradores podem atualizar chamados.',
    'Acesso negado. Apenas administradores podem enviar notificações.',
    'Para visualizar as tabelas e exportar os resultados, é necessário possuir uma licença ativa para esta grade.',
    'Tipo de arquivo não permitido. Apenas imagens (PNG, JPG, WEBP) e PDF são aceitos.',
    'O arquivo excede o limite máximo de 5MB.',
    'Apenas o status de leitura da notificação pode ser atualizado.',
]);

const SAFE_PREFIXES: { prefix: string; message: string }[] = [
    { prefix: 'Duração de plano inválida', message: 'Duração de plano inválida.' },
    { prefix: 'Quantidade de turmas inválida', message: 'Quantidade de turmas inválida.' },
    { prefix: 'A quantidade contratada', message: 'A quantidade contratada não pode ser menor que o total de turmas da grade.' },
];

const readMessage = (error: unknown) => {
    if (typeof error === 'string') return error.trim();
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message.trim();
    }
    return '';
};

export const toPublicError = (error: unknown, fallback: string) => {
    const message = readMessage(error);
    if (message === 'User not authenticated') return 'Sessão inválida. Faça login novamente.';
    if (SAFE_EXACT.has(message)) return message;

    const matched = SAFE_PREFIXES.find((item) => message.startsWith(item.prefix));
    return matched?.message ?? fallback;
};
