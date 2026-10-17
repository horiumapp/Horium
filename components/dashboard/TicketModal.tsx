import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ticketService } from '../../services/ticketService';
import { toPublicError } from '../../utils/publicError';
import { receiptFileProblem } from '../../utils/safeMedia';

interface TicketModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({ isOpen, onClose }) => {
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !description.trim()) {
            setError('Assunto e descrição são obrigatórios.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await ticketService.createTicket({ subject, description }, imageFile || undefined);
            setSuccess(true);
            setTimeout(() => {
                handleClose();
            }, 2000);
        } catch (err: any) {
            console.error('Erro ao abrir ticket:', err);
            setError(toPublicError(err, 'Erro ao enviar o ticket. Tente novamente mais tarde.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSubject('');
        setDescription('');
        setImageFile(null);
        setSuccess(false);
        setError(null);
        onClose();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const problem = receiptFileProblem(file, 'anexo');
        if (problem) {
            setImageFile(null);
            setError(problem);
            return;
        }
        setImageFile(file);
        setError(null);
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="md">
            <div className="p-6 sm:p-7">
                <div className="mb-6 flex items-center gap-3.5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-500/15 dark:text-blue-300">
                        <span className="material-symbols-outlined text-2xl">support_agent</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary dark:text-blue-300">Central de ajuda</p>
                        <h2 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">Abrir chamado de suporte</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Conte o que aconteceu e nossa equipe vai ajudar.</p>
                    </div>
                </div>

                {success ? (
                    <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-200">
                        <span className="material-symbols-outlined mt-0.5 text-xl">check_circle</span>
                        <span><strong className="block">Chamado enviado</strong>Retornaremos o contato em breve.</span>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
                                <span className="material-symbols-outlined text-lg">error</span>
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label htmlFor="ticket-subject" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Assunto *
                            </label>
                            <input
                                id="ticket-subject"
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Ex: Erro ao gerar grade"
                                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:hover:border-slate-600"
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="ticket-description" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Descrição do Problema *
                            </label>
                            <textarea
                                id="ticket-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detalhe o que aconteceu, quais passos você fez..."
                                rows={5}
                                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:hover:border-slate-600"
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Anexo <span className="font-normal text-slate-400">· opcional</span>
                            </label>
                            <div
                                role="group"
                                className={`rounded-2xl border border-dashed p-4 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${isSubmitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${imageFile ? 'border-primary/40 bg-primary/[0.04] dark:bg-primary/10' : 'border-slate-300 bg-slate-50/70 hover:border-primary/50 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800'}`}
                            >
                                <input
                                    id="ticket-image"
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/png,image/jpeg,image/webp,application/pdf"
                                    className="sr-only"
                                    aria-label="Selecionar imagem para anexar ao chamado"
                                    disabled={isSubmitting}
                                />

                                {imageFile ? (
                                    <div className="flex min-w-0 items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm dark:bg-slate-900"><span className="material-symbols-outlined">image</span></span>
                                        <span className="min-w-0 flex-1 text-left"><span className="block truncate font-semibold">{imageFile.name}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Imagem pronta para envio</span></span>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg px-2 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-blue-900/20" disabled={isSubmitting}>Trocar</button>
                                            <button type="button" aria-label="Remover imagem selecionada" onClick={() => { setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20" disabled={isSubmitting}>
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center gap-1.5 py-2 text-slate-500 transition dark:text-slate-400" disabled={isSubmitting}>
                                        <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-white text-primary shadow-sm dark:bg-slate-900"><span className="material-symbols-outlined text-xl">cloud_upload</span></span>
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Clique para selecionar uma imagem</span>
                                        <span className="text-xs">PNG, JPG, WEBP ou PDF · até 5 MB</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:justify-end sm:gap-3">
                            <Button
                                variant="secondary"
                                onClick={handleClose}
                                disabled={isSubmitting}
                                type="button"
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                type="submit"
                                disabled={isSubmitting || !subject.trim() || !description.trim()}
                            >
                                {isSubmitting ? 'Enviando...' : 'Enviar Chamado'}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </Modal>
    );
};
