
import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface TermsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
    onDecline: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({
    isOpen,
    onClose,
    onAccept,
    onDecline
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="TERMO DE ADESÃO AO CONTRATO DE LICENCIAMENTO DE USO DE SISTEMA EM WEBSITE"
            size="lg"
            headerColor="bg-primary"
        >
            <div className="p-8 text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar mb-8">
                    <section>
                        <h4 className="font-black text-lg text-gray-900 dark:text-white mb-3">1 – Definição do Serviço</h4>
                        <p>1.1. O Site horium.com, designado neste como horium, é um sistema 100% online de um serviço de processamento de dados inseridos pelo usuário para obtenção de uma grade de horário escolar. A partir da quantidade de turmas, professores, horários, grade curricular e restrições, o sistema executa combinações até chegar a uma versão que satisfaça as necessidades do Usuário.</p>
                        <p className="mt-2">1.2. O serviço prestado pelo Horium é oferecido por meio da plataforma WEB a qual é encontrada no Site e funciona mediante conexão à Internet.</p>
                    </section>

                    <section>
                        <h4 className="font-black text-lg text-gray-900 dark:text-white mb-3">2 - Cadastro</h4>
                        <p>2.1. Para a contratação dos Serviços é necessário que o Usuário realize um cadastro onde forneça voluntariamente informações sobre si, tais como: nome, sobrenome, e-mail, login, senha, nome da empresa o qual faz parte, telefone e outras informações necessárias (as “Informações Pessoais”). O Usuário declara que as Informações Pessoais fornecidas são fiéis e verdadeiras e compromete-se a manter seus dados sempre atualizados.</p>
                        <p className="mt-2">2.2. A conta é pessoal e poderá ser acessada unicamente mediante a utilização do login e senha criados pelo próprio Usuário no momento do cadastro, sendo o único e exclusivo responsável por manter o sigilo de seu login e senha.</p>
                        <p className="mt-2 text-primary font-bold">2.3. Após o cadastro, o Usuário já terá acesso ao Sistema através do login e senha escolhidos, porém de forma limitada, mas gratuita.</p>
                    </section>

                    <section>
                        <h4 className="font-black text-lg text-gray-900 dark:text-white mb-3">3. Planos de Assinatura</h4>
                        <p>3.1. Os serviços poderão ser contratados mediante a assinatura de uma LICENÇA.</p>
                        <p className="mt-2">3.2. A LICENÇA é composta por um NÚMERO MÁXIMO DE TURMAS e um TEMPO DE VALIDADE que podem ser escolhidos pelo Usuário.</p>
                        <p className="mt-2 italic">A disponibilidade de cada um deles poderá variar a qualquer momento, e portanto a lista abaixo não é exaustiva...</p>
                    </section>

                    {/* Add remaining sections as needed or keep it concise as requested by user's provide text */}
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                        <p className="font-bold mb-4">Texto Completo dos Termos:</p>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl text-xs font-serif whitespace-pre-wrap italic opacity-80">
                            {`1 – Definição do Serviço
1.1. O Site horium.com, designado neste como horium, é um sistema 100% online de um serviço de processamento de dados inseridos pelo usuário para obtenção de uma grade de horário escolar. A partir da quantidade de turmas, professores, horários, grade curricular e restrições, o sistema executa combinações até chegar a uma versão que satisfaça as necessidades do Usuário.
1.2. O serviço prestado pelo Horium é oferecido por meio da plataforma WEB a qual é encontrada no Site e funciona mediante conexão à Internet.

2 - Cadastro
2.1. Para a contratação dos Serviços é necessário que o Usuário realize um cadastro onde forneça voluntariamente informações sobre si, tais como: nome, sobrenome, e-mail, login, senha, nome da empresa o qual faz parte, telefone e outras informações necessárias (as “Informações Pessoais”). O Usuário declara que as Informações Pessoais fornecidas são fiéis e verdadeiras e compromete-se a manter seus dados sempre atualizados. O Horium não é responsável pelas informações prestadas, mas se reserva o direito de verificar, a qualquer momento, a veracidade de tais informações e solicitar, a seu exclusivo critério, a documentação suporte que julgar necessária para a devida comprovação das informações prestadas. Caso o Horium detecte algum cadastro efetuado a partir de informações falsas, o cadastro do Usuário será automaticamente cancelado de forma que o Usuário não mais terá acesso ao uso do Site e a qualquer Serviço, não assistindo ao Usuário, por esse motivo, qualquer sorte de indenização ou ressarcimento.
2.2. A conta é pessoal e poderá ser acessada unicamente mediante a utilização do login e senha criados pelo próprio Usuário no momento do cadastro, sendo o único e exclusivo responsável por manter o sigilo de seu login e senha, a fim de garantir a segurança de sua conta e impedir o acesso não autorizado por terceiros. O Usuário é o único responsável por todas as atividades associadas à sua conta. Em caso de perda, extravio ou suspeita de utilização indevida de sua conta, login ou senha, o Horium deverá ser imediatamente comunicado para que sejam tomadas as medidas cabíveis. Caso seja verificada a duplicidade de contas, o Horium poderá inabilitar de forma definitiva todos os cadastros duplicados, independentemente de qualquer notificação prévia.
2.3. Após o cadastro, o Usuário já terá acesso ao Sistema através do login e senha escolhidos, porém de forma limitada, mas gratuita. Caso o Usuário decida adquirir o uso da licença para visualização completa do Sistema, será necessário escolher o plano, efetuar o pagamento, encaminhar o comprovante de pagamento ao endereço eletrônico comercial@horium.com e em até 24 (vinte e quatro horas) úteis o acesso completo será liberado.

3. Planos de Assinatura
3.1. Os serviços poderão ser contratados mediante a assinatura de uma LICENÇA.
3.2. A LICENÇA é composta por um NÚMERO MÁXIMO DE TURMAS e um TEMPO DE VALIDADE que podem ser escolhidos pelo Usuário de acordo com as opções fornecidas pelo Horium.
3.3. O Horium se reserva o direito de modificar a disponibilidade das opções de TEMPO DE VALIDADE oferecidas a qualquer momento, sem aviso prévio.
3.3. O Usuário poderá escolher entre as opções de TEMPO DE VALIDADE disponíveis para formar a LICENÇA, ressalvando que a disponibilidade de cada um deles poderá variar a qualquer momento, e portanto a lista abaixo não é exaustiva e está sujeita a alterações conforme a conveniência do Horium:
(i) 3 Meses - Referente à licenças com duração de 90 dias corridos.
(ii) 6 Meses - Referente à licenças com duração de 180 dias corridos.
(iii) 12 Meses - Referente à licenças com duração de 360 dias corridos
(iv) 24 Meses - Referente à licenças com duração de 720 dias corridos
(v) Licença Ano corrente - Referente à licenças com data de vencimento no último dia do ano corrente.
(vi) Licença Ano subsequente - Referente à licenças com data de vencimento no último dia do ano subsequente.
3.4. A LICENÇA de uso é liberada e tem início a partir da data de confirmação do pagamento, expirando após o número de dias corridos ora contratados ou na data de vencimento, conforme descrito no item 3.3.
3.5. O valor da LICENÇA é calculado de forma proporcional ao NÚMERO MÁXIMO DE TURMAS e ao TEMPO DE VALIDADE, a qual pode ser orçada junto à equipe de suporte ou diretamente na página de ORÇAMENTO do site.
3.6. A LICENÇA se aplica somente para uma ÚNICA e DETERMINADA ESCOLA / INSTITUIÇÃO, a qual o número total de turmas considerando todos os turnos de funcionamento, seja menor ou igual ao NÚMERO MÁXIMO DE TURMAS contratado, não podendo o Usuário em hipótese alguma usar a mesma LICENÇA para:
(i) gerar a grade horária de outras escolas / instituições. 
(ii) gerar a grade horária de outros turnos de funcionamento da mesma escola / instituição que não estejam contabilizados no NÚMERO MÁXIMO DE TURMAS contratado na LICENÇA.
3.7. Conforme cláusula 7.1, é vedada a utilização da LICENÇA por Usuário estranho e fins diversos ao contratado.

4. Pagamento
4.1. O Horium oferece opções variadas de pagamento, incluindo boleto bancário, PIX, cartão de crédito, transferências bancárias e outras formas de pagamento que possam surgir, ressalvando que a disponibilidade dessa opções poderá ser alterada a qualquer momento, a critério do Horium.
4.2. Havendo a confirmação do pagamento, o Usuário terá liberação para acesso completo. Se o pagamento não for aprovado pela administradora do cartão ou for mal sucedido, a contratação dos Serviços poderá ser cancelada sendo que nenhum valor será cobrado do Usuário.
4.3. Valores de aquisição de LICENÇA poderão sofrer reajustes, no entanto, somente serão aplicados na renovação, se houver.

5. Cancelamento
5.1. O Usuário poderá desistir da contratação dos Serviços no prazo de 7 (sete) dias a contar do aceite ao presente Termo de Uso (o “Prazo de Reflexão”), sendo que todos os valores eventualmente pagos, a qualquer título, durante este prazo, serão devolvidos ao Usuário integralmente.
5.2. No caso de cancelamento da LICENÇA pelo Usuário após o Prazo de Reflexão, este poderá fazê-lo a qualquer momento sem cobrança de multa. Para tanto, o Usuário deverá encaminhar sua solicitação de cancelamento ao Horium via correio eletrônico (comercial@horium.com) estando ciente, desde já, a não devolução de valores pagos antecipadamente, salvo se a rescisão for provocada pelo Horium, que neste caso devolverá, proporcionalmente, o valor pago em relação aos dias que faltarem para completar o período de vigência dos reprocessamentos das soluções dos serviços prestados pelo site, assim como poderá o Horium reter todos os valores referentes à tributação, taxas de intermediação do pagamento e taxas de transferência que por ventura incidirem.
5.3. O Usuário está ciente de que ao cancelar a LICENÇA e/ou desfazer seu cadastro a ação será irreversível e todas as suas informações pessoais, bem como todo o conteúdo inserido no Sistema serão apagados em até 24 (vinte e quatro) horas do envio da solicitação, não sendo possível recuperar qualquer informação perdida. O Horium, em hipótese alguma, poderá ser responsabilizada por qualquer dano proveniente do cancelamento da LICENÇA e/ou desativação do cadastro.
5.4. O Horium reserva-se no direito de suspender ou cancelar, a qualquer momento, o acesso de qualquer Usuário ao Sistema em caso de comprovada fraude, obtenção de benefício ou vantagem de forma ilícita ou pelo não cumprimento de quaisquer das condições destes Termos de Uso. Nestes casos, não será devida qualquer indenização ao Usuário, podendo o Horium promover a competente ação de regresso, se necessário, bem como quaisquer outras medidas necessárias para perseguir e resguardar seus interesses.

6. Responsabilidades do Horium
6.1. O Horium garante que, ressalvadas as hipóteses previstas nestes Termos de Uso, o Sistema funcionará 24 (vinte e quatro) horas por dia, 7 (sete) dias por semana, devendo apresentar plenas condições de acesso e funcionamento durante, no mínimo, 95% (noventa e cinco por cento) do tempo que vigorar a LICENÇA escolhida pelo Usuário. Em caso de constatação de falhas na utilização do sistema ou dificuldades de acesso, a central de suporte do Horium deverá ser comunicada por e-mail horium.app@gmail.com
6.2. O Horium também oferecerá suporte básico ao Usuário com relação aos Serviços, o que implica no esclarecimento de dúvidas com relação ao uso do Sistema, eventuais problemas com relação a pagamentos e erros decorrentes da própria Plataforma.
6.3. O Horium reserva-se o direito de modificar, suspender ou descontinuar temporariamente as funcionalidades disponibilizadas no Sistema para realizar a manutenção, atualização e ajustes de configuração deste. O Horium não será responsável, sob quaisquer circunstâncias, por eventuais perdas e danos, incluindo lucros cessantes, relacionados à suspensão do acesso ao Sistema.
6.4. O Horium utiliza serviços de terceiros para manter o Site e o Sistema funcionando, podendo haver interrupções e/ou suspensões de natureza técnica e/ou operacional, alheias a vontade do Horium podendo eventualmente ocorrer falhas em tais serviços aos quais, em hipótese alguma, acarretarão em sua responsabilidade. O Horium não será responsável por quaisquer perdas e danos decorrentes de falha dos serviços destes terceiros.
6.5. O Horium não se responsabiliza pelas falhas de acesso ao Sistema decorrentes de circunstâncias alheias à sua vontade e controle, inclusive, sem limitação, falhas na internet em geral, quedas de energia, mau funcionamento eletrônico e/ou físico de qualquer rede de telecomunicações, interrupções ou suspensões de conexão e falhas nos softwares e/ou hardware utilizados pelos Usuários, bem como paralisações programadas para manutenção, atualização e ajustes de configuração do Sistema.
6.6. Nenhuma funcionalidade do Sistema deve ser entendida como aconselhamento ou consultoria a respeito das atividades desenvolvidas pelos Usuários. O Horium não garante aos Usuários qualquer resultado comercial e não será responsável pelo desenvolvimento de seus negócios ou consequências decorrentes.
6.7. O Horium também não se responsabiliza por negócios desfeitos ou não realizados, quebras de contratos, enfim, por eventual desinteresse entre formalização de negócios entre os Usuários e seus clientes sob a alegação de que houve informação privilegiada de algum terceiro por meio da Horium.

7. Responsabilidades do Usuário
7.1. São responsabilidades do Usuário:
(i) Para utilização dos serviços prestados pelo Horium, o Usuário deve contratar um serviço de internet com o qual o Horium não terá nenhuma responsabilidade sobre custos, fornecimento, manutenção e disponibilidade.
(ii) manter o ambiente de seus dispositivos de acesso ao Site e ao Sistema seguros, valendo-se de ferramentas específicas para tanto, tais como antivírus, firewall, entre outras, de modo a contribuir para a prevenção de riscos eletrônicos;
(iii) utilizar sistemas operacionais atualizados e eficientes para a plena utilização do Sistema;
(iv) equipar-se e responsabilizar-se pelos dispositivos de hardware e softwares necessários para o acesso ao Site e ao Sistema, bem como pelo acesso desses à Internet;
(v) não explorar maliciosamente a segurança do Site e do Sistema para a prática de atos ilícitos, proibidos pela lei e pelos presentes Termos de Uso, lesivos aos direitos e interesses de terceiros, ou que, de qualquer forma, possa danificar, inutilizar, sobrecarregar ou deteriorar o Site e o Sistema, bem como os equipamentos de informática de outros Usuários ou de outros internautas (hardware e software), assim como os documentos, arquivos e todo conteúdo armazenado em seus dispositivos ou impedir a normal utilização ou gozo do Site, do Sistema e dos Serviços;
(vi) manter cópia de todo conteúdo e dos dados que julgue importante, tendo em vista que o Sistema pode passar por períodos de manutenção ou instabilidade alheia a sua vontade.
(vii) garantir a veracidade, qualidade, integridade e legalidade de seus dados e do meio através do qual adquiriu os seus dados.
(viii) agir de forma a coibir o acesso não autorizado à utilização dos Serviços e notificar o Horium imediatamente de qualquer acesso não autorizado ou uso;
(ix) é proibido vender, revender, alugar, arrendar, emprestar, dar, doar, transferir, ceder, no todo ou em parte a LICENÇA contratada;
7.2. O Usuário declara e garante que todos os conteúdos inseridos por ele no Sistema:
(i) não violam a legislação brasileira, os dispositivos destes Termos de Uso e demais normas aplicáveis;
(ii) não infringem, nem infringirão, qualquer obrigação ou direto de quaisquer terceiros, seja pessoa natural ou entidade, incluindo, sem limitação, direitos de propriedade intelectual, direitos autorais, direitos de imagem, privacidade, direitos do consumidor, entre outros; e
(iii) não são ilegais, como, por exemplo, racistas, ameaçador, obsceno, pornográficos ou violentos e nem incitam à violência, tampouco atingem a honra de terceiro, e não são injuriosos, caluniosos ou difamantes, entre outros.
7.3. Qualquer dano causado pelo Usuário à Horium ou a terceiros em virtude do não cumprimento das obrigações aqui dispostas, ou da não veracidade das garantias aqui declaradas, será reparado exclusivamente pelo Usuário causador do dano, não havendo que se falar em subsidiariedade da obrigação, tampouco em solidariedade da Horium.

8. Propriedade Intelectual
8.1. Sujeito a estes Termos de Uso, o Horium concede ao Usuário uma licença limitada, temporária, não exclusiva e não transferível para usar o Sistema e o Site somente naquilo que seja estritamente necessário para o cumprimento das obrigações e fruição dos direitos dispostos nestes Termos de Uso.
8.2. Todos os direitos relativos ao Site e ao Sitema, bem como as suas funcionalidades, são de titularidade do Horium, inclusive no que diz respeito todos os direitos de propriedade intelectual relacionados aos seus textos, imagens, gráficos, marcas, layouts, códigos, bases de dados e demais conteúdos produzidos direta ou indiretamente pela Horium (“Direitos de Propriedade Intelectual”). É expressamente proibida a utilização indevida de quaisquer conteúdo ou marcas apresentadas no Site e no Sistema.
8.3. Os Direitos de Propriedade Intelectual são protegidos pelas leis de direitos autorais e de propriedade industrial. É proibido usar, copiar, reproduzir, modificar, traduzir, publicar, transmitir, distribuir, executar, fazer o upload, exibir, licenciar, vender ou explorar os Direitos de Propriedade Intelectual para qualquer finalidade. Nenhuma cópia, distribuição, engenharia reversa, exibição do Sistema, do Site e/ou dos Direitos de Propriedade Intelectual devem ser entendidos como restrição ou renúncia dos direitos de propriedade intelectual do Horium.
8.4. Qualquer utilização dos Direito de Propriedade Intelectual só poderá ser feita mediante prévia e expressa autorização do Horium. O Usuário assume toda e qualquer responsabilidade, de caráter civil e/ou criminal, pela utilização indevida e não autorizada dos Direito de Propriedade Intelectual.
8.5. Qualquer sugestão, solicitação de melhorias, recomendações ou outras ideias fornecidas pelo Usuário ao Horium, relacionadas com o funcionamento do Sistema, não conferirá ao Usuário qualquer direito de titularidade sobre as funcionalidades eventualmente implementadas pelo Horium de forma que o Usuário não terá qualquer direito de retenção, uso ou indenização.

9. Alteração destes Termos de Uso
9.1. O Horium está sempre executando atualizações para melhorar as funcionalidades do Sistema por esse motivo, estes Termos de Uso podem ser alterados a qualquer tempo e a exclusivo critério do Horium, a fim de refletir os ajustes realizados no Sistema. Sempre que ocorrer qualquer modificação nesses Termos de Uso, o Horium enviará um e-mail ao usuário indicando a data em que a referida alteração passará a ser vigente e solicitará ao Usuário o aceite das novas disposições por meio de checkbox que será disponibilizado ao Usuário ao acessar o Site ou o Sistema. Caso o Usuário não concorde com as novas disposições dos Termos de Uso, o Usuário poderá, a seu exclusivo critério, rejeitá-lo, mas, infelizmente, isso significa que o Usuário não poderá mais ter acesso ao Sistema e fazer uso de suas funcionalidades. Se de qualquer maneira o Usuário continuar a fazer uso do Sistema, mesmo após a alteração dos Termos de Uso, isso significa que o usuário concorda com todas as modificações.

10. Outras Disposições.
10.1. Estes Termos de Uso não criam qualquer outra modalidade de vínculo entre os Usuários e o Horium, inclusive, sem limitação, sociedade, joint-venture, mandato, representação, parceria, consórcio, associação, formação de grupo econômico, vínculo empregatício ou similar. O Horium permanecerá uma entidade independente e autônoma.
10.2. O Horium poderá ceder os direitos e obrigações referentes a estes Termos de Uso a empresas de seu mesmo grupo econômico ou societário, mediante simples comunicação por escrito ao Usuário.
10.3. A omissão ou tolerância do Horium em exigir o estrito cumprimento dos termos e condições aqui definidos não constituirá, em nenhuma hipótese, em novação ou renúncia, nem impedirá que o Horium cobre esses direitos a qualquer tempo.
10.4. Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Quaisquer dúvidas e situações não previstas nestes Termos de Uso serão primeiramente resolvidas pela Horium e, caso persistam, deverão ser solucionadas no foro da cidade de São Paulo, Estado de São Paulo, com renúncia de qualquer outro, por mais privilegiado que seja.
10.5. Qualquer dúvida ou solicitação relacionada a estes Termos de Uso deverá ser enviada ao Horium por meio do e-mail horium.app@gmail.com.`}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <Button
                        variant="primary"
                        className="flex-1"
                        onClick={onAccept}
                    >
                        Declaro que li e estou de acordo com os termos
                    </Button>
                    <Button
                        variant="secondary"
                        className="sm:w-auto"
                        onClick={onDecline}
                    >
                        NÃO aceito os termos - Sair
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
