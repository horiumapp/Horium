import { domToCanvas } from 'modern-screenshot';
import { jsPDF } from 'jspdf';

export interface DanfeLicense {
    id: string;
    payment_date?: string | null;
    classes_amount?: number | null;
    value_paid?: number | string | null;
    valid_until?: string | null;
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const formatDate = (dateString?: string | null) => {
    if (!dateString) return '—';
    const date = new Date(dateString.includes('T') ? dateString : `${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR').format(date);
};

const formatMoney = (value: number, digits = 2) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const invoiceNumber = (id: string) => {
    const digits = id.replace(/\D/g, '');
    const raw = (digits.slice(-9) || '1').padStart(9, '0');
    return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}`;
};

export const buildDanfeHtml = (license: DanfeLicense, recipientName: string) => {
    const total = Number(license.value_paid) || 0;
    const classes = license.classes_amount ?? 0;
    const issuedAt = formatDate(license.payment_date);
    const number = invoiceNumber(license.id);
    const description = `Licença de uso Horium — ${classes} turmas`;
    const recipient = escapeHtml(recipientName || 'Destinatário da licença');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFE - Licença Horium ${number}</title>
  <style>
    .danfe-scope, .danfe-scope * { box-sizing: border-box; }
    .danfe-scope { font-family: "Times New Roman", Arial, sans-serif; background: #e2e8f0; padding: 20px; color: #000; }
    .danfe-page { width: 210mm; min-height: 297mm; background: #fff; margin: 0 auto; padding: 8mm; box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
    .no-print { text-align: center; margin-bottom: 15px; }
    .btn-print { background: #2563eb; color: #fff; border: none; padding: 10px 20px; font-family: sans-serif; font-weight: bold; border-radius: 6px; cursor: pointer; }
    .row { display: flex; width: 100%; border-left: 1px solid #000; border-top: 1px solid #000; }
    .row:last-child, .border-bottom { border-bottom: 1px solid #000; }
    .col { border-right: 1px solid #000; padding: 2px 4px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
    .lbl { font-size: 6pt; text-transform: uppercase; color: #222; margin-bottom: 2px; line-height: 1; }
    .val { font-size: 8.5pt; font-weight: bold; line-height: 1.1; }
    .val-normal { font-size: 8pt; font-weight: normal; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .section-title { font-size: 7pt; font-weight: bold; text-transform: uppercase; margin-top: 3mm; margin-bottom: 1mm; letter-spacing: 0.3px; }
    .linha-pontilhada { border-bottom: 1px dashed #000; margin: 4mm 0; }
    .barcode { height: 11mm; width: 100%; background: repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 5px, transparent 5px, transparent 8px); margin: 2px 0; }
    table.prod-table { width: 100%; border-collapse: collapse; font-size: 7pt; }
    table.prod-table th, table.prod-table td { border: 1px solid #000; padding: 2px 3px; }
    table.prod-table th { font-size: 6pt; background: #f8f8f8; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="danfe-page">
    <div class="row">
      <div class="col" style="width: 80%;">
        <span class="lbl">RECEBEMOS DE HORIUM OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO</span>
        <div style="display: flex; border-top: 1px solid #000; margin-top: 4px; padding-top: 2px;">
          <div style="width: 30%; border-right: 1px solid #000; padding-right: 4px;">
            <span class="lbl">DATA DE RECEBIMENTO</span>
            <div style="height: 14px;"></div>
          </div>
          <div style="width: 70%; padding-left: 4px;">
            <span class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
            <div style="height: 14px;"></div>
          </div>
        </div>
      </div>
      <div class="col text-center" style="width: 20%; justify-content: center;">
        <div style="font-size: 10pt; font-weight: bold;">NF-e</div>
        <div class="val">Nº ${number}</div>
        <div class="val">SÉRIE 001</div>
      </div>
    </div>
    <div class="border-bottom"></div>
    <div class="linha-pontilhada"></div>
    <div class="row">
      <div class="col" style="width: 42%; justify-content: center; text-align: center; padding: 6px;">
        <div style="font-size: 11pt; font-weight: bold; margin-bottom: 4px;">HORIUM</div>
        <div class="val-normal">Licença de uso de software</div>
        <div class="val-normal">comercial@horium.com</div>
      </div>
      <div class="col text-center" style="width: 16%; justify-content: space-around;">
        <div>
          <div style="font-size: 12pt; font-weight: bold;">DANFE</div>
          <div style="font-size: 6pt;">Documento Auxiliar da Nota Fiscal Eletrônica</div>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-around; font-size: 6.5pt; text-align: left;">
          <div>0 - ENTRADA<br>1 - SAÍDA</div>
          <div style="border: 1px solid #000; padding: 2px 6px; font-weight: bold; font-size: 9pt;">1</div>
        </div>
        <div>
          <div class="val" style="font-size: 8pt;">Nº ${number}</div>
          <div class="val" style="font-size: 7.5pt;">SÉRIE 001 • Folha 1/1</div>
        </div>
      </div>
      <div class="col" style="width: 42%;">
        <div class="barcode"></div>
        <div style="border-top: 1px solid #000; padding-top: 2px;">
          <span class="lbl">CHAVE DE ACESSO</span>
          <div class="val text-center" style="font-size: 7.8pt; letter-spacing: 0.5px;">SEM CHAVE DE ACESSO SEFAZ</div>
        </div>
        <div style="border-top: 1px solid #000; padding-top: 2px; font-size: 6.5pt; text-align: center;">
          Este DANFE espelha o pagamento da licença. Não substitui NF-e autorizada.
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col" style="width: 58%;">
        <span class="lbl">NATUREZA DA OPERAÇÃO</span>
        <span class="val">Licenciamento de uso de software</span>
      </div>
      <div class="col" style="width: 42%;">
        <span class="lbl">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
        <span class="val">Não autorizado na SEFAZ</span>
      </div>
    </div>
    <div class="row border-bottom">
      <div class="col" style="width: 33%;"><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val">—</span></div>
      <div class="col" style="width: 33%;"><span class="lbl">INSCRIÇÃO ESTADUAL DO SUBST. TRIBUTÁRIO</span><span class="val"></span></div>
      <div class="col" style="width: 34%;"><span class="lbl">CNPJ</span><span class="val">—</span></div>
    </div>
    <div class="section-title">Destinatário / Remetente</div>
    <div class="row">
      <div class="col" style="width: 60%;">
        <span class="lbl">NOME / RAZÃO SOCIAL</span>
        <span class="val">${recipient}</span>
      </div>
      <div class="col" style="width: 25%;"><span class="lbl">CNPJ / CPF</span><span class="val">—</span></div>
      <div class="col" style="width: 15%;"><span class="lbl">DATA DA EMISSÃO</span><span class="val text-center">${issuedAt}</span></div>
    </div>
    <div class="row">
      <div class="col" style="width: 45%;"><span class="lbl">ENDEREÇO</span><span class="val">—</span></div>
      <div class="col" style="width: 25%;"><span class="lbl">BAIRRO / DISTRITO</span><span class="val">—</span></div>
      <div class="col" style="width: 15%;"><span class="lbl">CEP</span><span class="val">—</span></div>
      <div class="col" style="width: 15%;"><span class="lbl">DATA DA SAÍDA</span><span class="val text-center">${issuedAt}</span></div>
    </div>
    <div class="row border-bottom">
      <div class="col" style="width: 40%;"><span class="lbl">MUNICÍPIO</span><span class="val">—</span></div>
      <div class="col" style="width: 20%;"><span class="lbl">FONE / FAX</span><span class="val">—</span></div>
      <div class="col" style="width: 5%;"><span class="lbl">UF</span><span class="val text-center">—</span></div>
      <div class="col" style="width: 20%;"><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val">—</span></div>
      <div class="col" style="width: 15%;"><span class="lbl">HORA DA SAÍDA</span><span class="val text-center">—</span></div>
    </div>
    <div class="section-title">Cálculo do Imposto</div>
    <div class="row">
      <div class="col" style="width: 20%;"><span class="lbl">BASE DE CÁLC. DO ICMS</span><span class="val text-right">0,00</span></div>
      <div class="col" style="width: 20%;"><span class="lbl">VALOR DO ICMS</span><span class="val text-right">0,00</span></div>
      <div class="col" style="width: 20%;"><span class="lbl">BASE CÁLC. ICMS S.T.</span><span class="val text-right">0,00</span></div>
      <div class="col" style="width: 20%;"><span class="lbl">VALOR DO ICMS SUBST.</span><span class="val text-right">0,00</span></div>
      <div class="col" style="width: 20%;"><span class="lbl">V. TOTAL DOS PRODUTOS</span><span class="val text-right">${formatMoney(total)}</span></div>
    </div>
    <div class="row border-bottom">
      <div class="col" style="width: 16%;"><span class="lbl">VALOR DO FRETE</span><span class="val text-right">0,00</span></div>
      <div class="col" style="width: 16%;"><span class="lbl">VALOR DO SEGURO</span><span class="val text-right">0,00</span></div>
      <div class="col" style="width: 16%;"><span class="lbl">DESCONTO</span><span class="val text-right">0,00</span></div>
      <div class="col" style="width: 16%;"><span class="lbl">OUTRAS DESP.</span><span class="val text-right">0,00</span></div>
      <div class="col" style="width: 16%;"><span class="lbl">VALOR DO IPI</span><span class="val text-right">0,00</span></div>
      <div class="col" style="width: 20%; background: #f1f5f9;"><span class="lbl">V. TOTAL DA NOTA</span><span class="val text-right">${formatMoney(total)}</span></div>
    </div>
    <div class="section-title">Transportador / Volumes Transportados</div>
    <div class="row border-bottom">
      <div class="col" style="width: 45%;"><span class="lbl">NOME / RAZÃO SOCIAL</span><span class="val">SEM TRANSPORTE</span></div>
      <div class="col" style="width: 25%;"><span class="lbl">FRETE POR CONTA</span><span class="val">9 - Sem Transporte</span></div>
      <div class="col" style="width: 15%;"><span class="lbl">PLACA DO VEÍCULO</span><span class="val"></span></div>
      <div class="col" style="width: 15%;"><span class="lbl">CNPJ / CPF</span><span class="val"></span></div>
    </div>
    <div class="section-title">Dados dos Produtos / Serviços</div>
    <table class="prod-table">
      <thead>
        <tr>
          <th style="width: 10%;">CÓDIGO</th>
          <th style="width: 36%;">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
          <th style="width: 9%;">NCM/SH</th>
          <th style="width: 6%;">CSOSN</th>
          <th style="width: 6%;">CFOP</th>
          <th style="width: 5%;">UN</th>
          <th style="width: 7%;">QTD</th>
          <th style="width: 9%;">V. UNIT</th>
          <th style="width: 9%;">V. TOTAL</th>
          <th style="width: 3%;">ICMS</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>LIC-HORIUM</td>
          <td>${escapeHtml(description)}</td>
          <td class="text-center">—</td>
          <td class="text-center">—</td>
          <td class="text-center">—</td>
          <td class="text-center">UN</td>
          <td class="text-right">1,0000</td>
          <td class="text-right">${formatMoney(total, 4)}</td>
          <td class="text-right">${formatMoney(total)}</td>
          <td class="text-right">0,00</td>
        </tr>
        <tr style="height: 95mm;"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    <div class="section-title">Dados Adicionais</div>
    <div class="row border-bottom" style="height: 28mm;">
      <div class="col" style="width: 65%; justify-content: flex-start;">
        <span class="lbl">INFORMAÇÕES COMPLEMENTARES</span>
        <div class="val-normal" style="margin-top: 3px;">
          Licença Horium (${classes} turmas), válida até ${formatDate(license.valid_until)}.<br>
          Não é NF-e autorizada pela SEFAZ e não gera crédito fiscal.
        </div>
      </div>
      <div class="col" style="width: 35%; justify-content: flex-start;">
        <span class="lbl">RESERVADO AO FISCO</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const scopeDanfeCss = (css: string) =>
    css.replace(/(^|})\s*([^@{}][^{]*)\{/g, (_match, prefix: string, selector: string) => {
        const scoped = selector.split(',').map((part) => {
            const trimmed = part.trim();
            if (!trimmed || trimmed.startsWith('.danfe-scope')) return trimmed;
            return `.danfe-scope ${trimmed}`;
        }).join(', ');
        return `${prefix} ${scoped} {`;
    });

export const getDanfeMarkup = (license: DanfeLicense, recipientName: string) => {
    const html = buildDanfeHtml(license, recipientName);
    const css = scopeDanfeCss(html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '');
    const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';
    return { css, body: `<div class="danfe-scope">${body}</div>` };
};

let pdfCaptureQueue: Promise<unknown> = Promise.resolve();

export const createDanfePdf = async (page: HTMLElement) => {
    const capture = pdfCaptureQueue.then(() => renderDanfePdf(page));
    pdfCaptureQueue = capture.then(() => undefined, () => undefined);
    return capture;
};

const renderDanfePdf = async (page: HTMLElement) => {
    const host = document.createElement('div');
    host.className = 'danfe-scope';
    host.style.position = 'fixed';
    host.style.left = '0';
    host.style.top = '0';
    host.style.width = `${page.offsetWidth}px`;
    host.style.background = '#ffffff';
    host.style.zIndex = '-1';
    host.appendChild(page.cloneNode(true));
    document.body.appendChild(host);

    let canvas: HTMLCanvasElement;
    try {
        const clone = host.firstElementChild;
        if (!(clone instanceof HTMLElement)) {
            throw new Error('A nota não pôde ser copiada para o PDF.');
        }
        canvas = await domToCanvas(clone, {
            scale: 2,
            backgroundColor: '#ffffff'
        });
    } finally {
        host.remove();
    }

    if (!canvas.width || !canvas.height) {
        throw new Error('A nota foi capturada sem tamanho.');
    }
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const image = canvas.toDataURL('image/png');
    const imageRatio = canvas.height / canvas.width;
    let drawWidth = pageWidth;
    let drawHeight = drawWidth * imageRatio;

    if (drawHeight > pageHeight) {
        drawHeight = pageHeight;
        drawWidth = drawHeight / imageRatio;
    }

    const x = (pageWidth - drawWidth) / 2;
    pdf.addImage(image, 'PNG', x, 0, drawWidth, drawHeight);

    return pdf.output('blob');
};

