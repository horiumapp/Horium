import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ticketService } from '../../services/ticketService';

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
            setError(err.message || 'Erro ao enviar o ticket. Tente novamente mais tarde.');
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
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError('A imagem deve ter no máximo 5MB.');
                return;
            }
            setImageFile(file);
            setError(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="md">
            <div className="p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Abrir Chamado de Suporte</h2>

                {success ? (
                    <div className="bg-green-100 text-green-800 p-4 rounded-lg flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined">check_circle</span>
                        Ticket enviado com sucesso! Retornaremos o contato em breve.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-100 text-red-800 p-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Assunto *
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Ex: Erro ao gerar grade"
                                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white"
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Descrição do Problema *
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detalhe o que aconteceu, quais passos você fez..."
                                rows={4}
                                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white resize-none"
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Anexo (Print do erro) - Opcional
                            </label>
                            <div
                                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${imageFile ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600 hover:border-primary/50'
                                    }`}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                    disabled={isSubmitting}
                                />

                                {imageFile ? (
                                    <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                                        <span className="truncate max-w-[200px]">{imageFile.name}</span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setImageFile(null); }}
                                            className="text-red-500 hover:text-red-700 p-1"
                                            disabled={isSubmitting}
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <span className="material-symbols-outlined">cloud_upload</span>
                                        <span className="text-sm">Clique para selecionar uma imagem</span>
                                        <span className="text-xs">Max 5MB (PNG, JPG)</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
