#!/usr/bin/env python3
"""Gera o relatório de auditoria de segurança do Horium (A4, pt-BR).

Uso, a partir desta pasta, em um venv isolado:

    python -m venv .venv
    .venv\\Scripts\\pip install -r requirements.txt
    .venv\\Scripts\\python gerar_relatorio.py

Não altera código de aplicação. Reescreve apenas o PDF e os gráficos
intermediários em docs/security-audit/_build/.
"""

from __future__ import annotations

import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent
BUILD = ROOT / "_build"
PDF_PATH = ROOT / "relatorio-auditoria-seguranca.pdf"

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm

CRITICA = HexColor("#B91C1C")
ALTA = HexColor("#EA580C")
MEDIA = HexColor("#D97706")
BAIXA = HexColor("#2563EB")
FORTE = HexColor("#059669")
INK = HexColor("#111827")
MUTED = HexColor("#4B5563")
LINE = HexColor("#E5E7EB")
SOFT = HexColor("#F8FAFC")
CODE_BG = HexColor("#F3F4F6")
NAVY = HexColor("#0F2744")

SEV_COLOR = {
    "CRÍTICA": CRITICA,
    "ALTA": ALTA,
    "MÉDIA": MEDIA,
    "BAIXA": BAIXA,
}


def register_fonts() -> None:
    windir = Path(os.environ.get("WINDIR", r"C:\Windows"))
    fonts = windir / "Fonts"
    pdfmetrics.registerFont(TTFont("Arial", str(fonts / "arial.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Bold", str(fonts / "arialbd.ttf")))
    pdfmetrics.registerFont(TTFont("Consolas", str(fonts / "consola.ttf")))


def styles() -> dict[str, ParagraphStyle]:
    return {
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            fontName="Arial",
            fontSize=11,
            textColor=HexColor("#BFDBFE"),
            tracking=0.6,
            leading=14,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            fontName="Arial-Bold",
            fontSize=28,
            leading=34,
            textColor=white,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            fontName="Arial",
            fontSize=12,
            leading=17,
            textColor=HexColor("#E5E7EB"),
        ),
        "h1": ParagraphStyle(
            "h1",
            fontName="Arial-Bold",
            fontSize=16,
            leading=20,
            textColor=NAVY,
            spaceBefore=8,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            fontName="Arial-Bold",
            fontSize=12.5,
            leading=16,
            textColor=NAVY,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "h3": ParagraphStyle(
            "h3",
            fontName="Arial-Bold",
            fontSize=11,
            leading=14,
            textColor=INK,
            spaceBefore=8,
            spaceAfter=3,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="Arial",
            fontSize=10,
            leading=14,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "small",
            fontName="Arial",
            fontSize=8.5,
            leading=11.5,
            textColor=INK,
            alignment=TA_LEFT,
        ),
        "small_center": ParagraphStyle(
            "small_center",
            fontName="Arial-Bold",
            fontSize=8,
            leading=10,
            textColor=white,
            alignment=TA_CENTER,
        ),
        "th": ParagraphStyle(
            "th",
            fontName="Arial-Bold",
            fontSize=8,
            leading=10.5,
            textColor=white,
        ),
        "td": ParagraphStyle(
            "td",
            fontName="Arial",
            fontSize=8,
            leading=10.5,
            textColor=INK,
        ),
        "td_b": ParagraphStyle(
            "td_b",
            fontName="Arial-Bold",
            fontSize=8,
            leading=10.5,
            textColor=INK,
        ),
        "label": ParagraphStyle(
            "label",
            fontName="Arial-Bold",
            fontSize=9,
            leading=12,
            textColor=NAVY,
            spaceBefore=2,
        ),
        "issue": ParagraphStyle(
            "issue",
            fontName="Consolas",
            fontSize=7.5,
            leading=10,
            textColor=INK,
            alignment=TA_LEFT,
        ),
        "footer": ParagraphStyle(
            "footer",
            fontName="Arial",
            fontSize=8,
            textColor=MUTED,
        ),
    }


S = None  # filled in main


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def P(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def chip(label: str) -> Table:
    color = SEV_COLOR[label]
    inner = Paragraph(label, S["small_center"])
    table = Table([[inner]], colWidths=[62])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), color),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    return table


def section_rule() -> HRFlowable:
    return HRFlowable(width="100%", thickness=1, color=LINE, spaceBefore=2, spaceAfter=8)


def make_table(headers: list[str], rows: list[list], col_widths: list[float]) -> Table:
    head = [Paragraph(esc(h), S["th"]) for h in headers]
    body = []
    for row in rows:
        cells = []
        for idx, cell in enumerate(row):
            if isinstance(cell, Table):
                cells.append(cell)
            else:
                style = "td_b" if idx == 0 else "td"
                cells.append(Paragraph(str(cell), S[style]))
        body.append(cells)
    table = Table([head] + body, colWidths=col_widths, repeatRows=1)
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.3, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
    ]
    for i in range(1, len(body) + 1):
        if i % 2 == 0:
            commands.append(("BACKGROUND", (0, i), (-1, i), SOFT))
    table.setStyle(TableStyle(commands))
    return table


def wrap_long_lines(text: str, limit: int = 88) -> str:
    """Quebra só em espaços, para a linha caber na largura útil sem cortar palavras."""
    out: list[str] = []
    for raw in text.split("\n"):
        line = raw
        while len(line) > limit:
            cut = line.rfind(" ", 0, limit + 1)
            if cut <= 0:
                cut = limit
            out.append(line[:cut].rstrip())
            line = line[cut:].lstrip()
        out.append(line)
    return "\n".join(out)


def code_block(text: str) -> Table:
    html = "<br/>".join(
        esc(line) if line else "&nbsp;" for line in wrap_long_lines(text).split("\n")
    )
    pre = Paragraph(html, S["issue"])
    wrapper = Table([[pre]], colWidths=[PAGE_W - 2 * MARGIN])
    wrapper.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("BOX", (0, 0), (-1, -1), 0.4, LINE),
            ]
        )
    )
    return wrapper


def bullets(items: list[str]) -> ListFlowable:
    flow = []
    for item in items:
        flow.append(
            ListItem(Paragraph(item, S["body"]), leftIndent=8, bulletColor=NAVY)
        )
    return ListFlowable(
        flow,
        bulletType="bullet",
        start="•",
        leftIndent=14,
        bulletFontName="Arial",
        bulletFontSize=10,
        spaceBefore=0,
        spaceAfter=6,
    )


def draw_header_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 1.15 * cm, PAGE_W, 1.15 * cm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Arial", 8)
    canvas.drawString(MARGIN, PAGE_H - 0.72 * cm, "Relatório de Auditoria de Segurança — Horium")
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, 1.05 * cm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Arial", 8)
    canvas.drawString(MARGIN, 0.42 * cm, "Auditoria estática · 15 de outubro de 2026")
    canvas.drawRightString(PAGE_W - MARGIN, 0.42 * cm, f"Página {doc.page}")
    canvas.restoreState()


def draw_cover(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(ALTA)
    canvas.rect(0, 0, 0.45 * cm, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#1E3A5F"))
    canvas.rect(0, 2.2 * cm, PAGE_W, 2.4 * cm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Arial", 9)
    canvas.drawString(MARGIN, 3.35 * cm, "Documento confidencial para o time de engenharia")
    canvas.setFont("Arial", 8)
    canvas.drawString(MARGIN, 2.7 * cm, "Página 1")
    canvas.drawRightString(PAGE_W - MARGIN, 2.7 * cm, "Horium")
    canvas.restoreState()


def build_charts() -> tuple[Path, Path]:
    BUILD.mkdir(parents=True, exist_ok=True)
    severities = ["Crítica", "Alta", "Média", "Baixa"]
    sev_values = [0, 1, 2, 2]
    sev_colors = ["#B91C1C", "#EA580C", "#D97706", "#2563EB"]
    # Rosca só com fatias positivas; crítica zero fica no rótulo.
    labels = ["Alta", "Média", "Baixa"]
    values = [1, 2, 2]
    colors = ["#EA580C", "#D97706", "#2563EB"]

    fig, ax = plt.subplots(figsize=(4.6, 3.4), dpi=140)
    wedges, _texts = ax.pie(
        values,
        colors=colors,
        startangle=90,
        wedgeprops={"width": 0.42, "edgecolor": "white", "linewidth": 2},
    )
    ax.legend(
        wedges,
        [f"{name} ({count})" for name, count in zip(labels, values)],
        loc="center left",
        bbox_to_anchor=(0.98, 0.5),
        frameon=False,
        fontsize=9,
    )
    ax.text(0, 0.08, "5", ha="center", va="center", fontsize=20, fontweight="bold", color="#0F2744")
    ax.text(0, -0.18, "achados", ha="center", va="center", fontsize=9, color="#4B5563")
    ax.set_title("Achados por severidade", fontsize=11, color="#0F2744", pad=8)
    fig.tight_layout()
    donut = BUILD / "severidade.png"
    fig.savefig(donut, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    cats = ["Isolamento", "Autorização", "IDOR", "Secrets", "XSS / URLs"]
    counts = [0, 2, 1, 1, 1]
    fig, ax = plt.subplots(figsize=(6.4, 3.3), dpi=140)
    bars = ax.barh(cats[::-1], counts[::-1], color=["#94A3B8", "#2563EB", "#D97706", "#EA580C", "#059669"][::-1], height=0.62)
    # Recolor explicitly to a stable mapping.
    palette = {
        "Isolamento": "#94A3B8",
        "Autorização": "#EA580C",
        "IDOR": "#D97706",
        "Secrets": "#2563EB",
        "XSS / URLs": "#059669",
    }
    for bar, name in zip(bars, cats[::-1]):
        bar.set_color(palette[name])
        ax.text(bar.get_width() + 0.05, bar.get_y() + bar.get_height() / 2, str(int(bar.get_width())), va="center", fontsize=9, color="#111827")
    ax.set_xlim(0, 3.2)
    ax.set_xlabel("Achados confirmados")
    ax.set_title("Achados por categoria", fontsize=11, color="#0F2744")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    bars_path = BUILD / "categorias.png"
    fig.savefig(bars_path, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return donut, bars_path


def finding_block(number: int, title: str, meta: list[tuple[str, str]], snippet: str) -> list:
    parts = [P(f"{number}. {title}", "h2"), section_rule()]
    for label, value in meta:
        parts.append(P(f"<b>{esc(label)}.</b> {value}", "body"))
    parts.append(KeepTogether([
        P("<b>Trecho.</b>", "label"),
        code_block(snippet),
        Spacer(1, 6),
    ]))
    return parts


def build_story(donut: Path, bars: Path) -> list:
    usable = PAGE_W - 2 * MARGIN
    story: list = []

    story.append(Spacer(1, 4.2 * cm))
    story.append(P("AUDITORIA ESTÁTICA", "cover_kicker"))
    story.append(Spacer(1, 0.3 * cm))
    story.append(P("Relatório de Auditoria<br/>de Segurança —", "cover_title"))
    story.append(Spacer(1, 0.45 * cm))
    story.append(P("Horium — sistema de gestão de horário escolar", "cover_sub"))
    story.append(Spacer(1, 0.8 * cm))
    story.append(P("15 de outubro de 2026", "cover_sub"))
    story.append(P("Escopo: código e configuração versionados neste repositório", "cover_sub"))
    story.append(P("Método: revisão estática com cadeia de evidência. Sem alteração de aplicação.", "cover_sub"))
    story.append(NextPageTemplate("body"))
    story.append(PageBreak())

    story.append(P("1. Escopo, stack e método", "h1"))
    story.append(section_rule())
    story.append(P(
        "A auditoria examinou o repositório Horium como uma aplicação de página única. "
        "Não há servidor HTTP próprio: o navegador fala direto com o Supabase usando a chave anônima pública. "
        "O controle de acesso efetivo está em <font face='Consolas' size='9'>schema.sql</font> "
        "(RLS, triggers e funções) e nos serviços do cliente que chamam essas APIs."
    ))
    story.append(P("<b>Stack detectada</b>", "h2"))
    story.append(make_table(
        ["Camada", "O que o repositório usa"],
        [
            ["Linguagem", "TypeScript e SQL (PostgreSQL)"],
            ["Frontend", "React 19 e Vite 6. Sem Next.js e sem backend Node."],
            ["Runtime", "Navegador. Build estático publicado com vercel.json."],
            ["Dados", "Supabase: Auth, PostgREST, Storage e RPC."],
            ["ORM", "Não há. Consultas via supabase-js e SQL no schema."],
            ["Autenticação", "supabase.auth (senha, OTP, sessão persistida)."],
            ["Autorização", "RLS por auth.uid(), is_admin() e checagens dentro das RPC."],
            ["Isolamento", "user_id nas policies. Não há tenant, workspace nem RLS por organização."],
            ["Arquivos", "Buckets privados receipts e tickets-attachments."],
            ["Externos", "Supabase, fontes Google, avatares Dicebear, payload PIX no cliente."],
            ["Docker / K8s / IaC / CI", "Ausentes neste repositório."],
            ["Secrets", ".env.example com placeholders. Chave real só via VITE_* no build."],
            ["Testes", "Vitest em services/__tests__ e utils/__tests__."],
        ],
        [4.2 * cm, usable - 4.2 * cm],
    ))
    story.append(Spacer(1, 8))
    story.append(P("<b>Fronteiras de confiança</b>", "h2"))
    story.append(bullets([
        "Navegador para o bundle Vite: todo segredo com prefixo VITE_ fica público.",
        "Bundle para a API Supabase: a chave anon só abre o que a RLS e as RPC permitirem.",
        "API para o Postgres: policies, triggers e funções SECURITY DEFINER.",
        "API para o Storage: policies em storage.objects por pasta do usuário.",
        "Não há workers de servidor nem pipeline de CI versionado.",
    ]))
    story.append(P("<b>Nota metodológica</b>", "h2"))
    story.append(P(
        "Um achado só entra como confirmado quando a cadeia está no código: entrada controlável, "
        "fluxo até um recurso sensível e ausência ou falha do controle que deveria barrar essa entrada. "
        "Policies, triggers, RPC e o mascaramento no React foram lidos em conjunto. "
        "Padrão perigoso isolado, tabela sem escritor e chave anon de papel público não foram contados."
    ))
    story.append(P("<b>Limitações</b>", "h2"))
    story.append(bullets([
        "O banco em produção não foi consultado. O veredito vale para schema.sql como definição versionada.",
        "Não houve exploit ao vivo, varredura de dependências nem teste de penetração.",
        "O bundle de produção não está no repositório. O código-fonte do cliente foi tratado como o que o navegador recebe.",
        "O histórico Git contém apenas .env.example além do código. O conteúdo desse arquivo foi conferido nos commits a5db3e7 e 1962d12.",
    ]))

    story.append(CondPageBreak(5.5 * cm))
    story.append(P("2. Resumo executivo", "h1"))
    story.append(section_rule())
    story.append(P(
        "Foram confirmados <b>5 achados</b>: 1 alto, 2 médios e 2 baixos. "
        "Nenhum é crítico e nenhum permite, com o schema atual, ler a grade de outro usuário. "
        "O risco principal é o paywall da solução horária: um usuário autenticado grava a própria grade com "
        "<font face='Consolas' size='9'>is_licensed = true</font> e a solução permanece em "
        "<font face='Consolas' size='9'>schedules.data</font>, porque o trigger que isola as aulas roda antes do trigger que zera a licença."
    ))
    story.append(make_table(
        ["Severidade", "Quantidade", "Leitura"],
        [
            [chip("CRÍTICA"), "0", "Nenhum acesso anônimo ao dado de outro usuário foi demonstrado."],
            [chip("ALTA"), "1", "Paywall da solução contornável por qualquer conta autenticada."],
            [chip("MÉDIA"), "2", "Solução permanece legível após revogação; URL de comprovante sem allowlist."],
            [chip("BAIXA"), "2", "Caminho de comprovante sem pasta do dono; PIX com fallback fixo."],
        ],
        [3.1 * cm, 2.4 * cm, usable - 5.5 * cm],
    ))
    story.append(Spacer(1, 8))
    img_row = Table(
        [[Image(str(donut), width=8.6 * cm, height=6.2 * cm), Image(str(bars), width=8.6 * cm, height=6.2 * cm)]],
        colWidths=[usable / 2, usable / 2],
    )
    img_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(img_row)
    story.append(Spacer(1, 6))
    story.append(P(
        "Distribuição por categoria: Autorização 2, IDOR 1, Secrets 1, XSS/URLs 1, Isolamento cross-tenant 0. "
        "A rosca omite a fatia crítica porque o valor é zero; o total do centro é a soma dos achados confirmados.",
        "small",
    ))

    story.append(P("3. Pontos fortes", "h1"))
    story.append(section_rule())
    story.append(P(
        "Os controles abaixo foram lidos no fluxo correspondente e seguram o ataque que o comentário do schema descreve."
    ))
    story.append(make_table(
        ["Controle", "Evidência", "O que impede"],
        [
            ["RLS de schedules", "schema.sql:83-100", "SELECT, UPDATE e DELETE de grade alheia. A policy exige auth.uid() = user_id ou admin."],
            ["RLS de licenses", "schema.sql:210-229", "Usuário comum só lê a própria licença. INSERT direto foi removido."],
            ["Preço no servidor", "schema.sql:588-677", "request_license_order ignora valor enviado pelo cliente e confere o dono da grade."],
            ["RPC administrativas", "schema.sql:401-403, 439-441, 504-506, 546-548, 574-576, 826-828", "get_admin_licenses, approve, delete, tickets e send_admin_notification chamam is_admin()."],
            ["schedule_solutions", "schema.sql:138-143", "A tabela da solução só tem policy de admin. O cliente não lê essa tabela direto."],
            ["Storage", "schema.sql:763-801", "Upload e leitura exigem a primeira pasta igual a auth.uid(), ou admin na leitura."],
            ["Conteúdo de notificação", "schema.sql:254-272", "Usuário comum não altera title, message nem user_id."],
            ["Tickets", "schema.sql:300-310", "INSERT exige o próprio user_id. UPDATE de status é só admin, também na RPC."],
            ["XSS de esquema", "adminLicenseService.ts:34-47 e AdminPanelPage.tsx:143", "javascript:, data: e afins são recusados antes de href, img e iframe."],
            ["Texto de UI", "Layout.tsx:311-317", "Título e mensagem de notificação entram como texto React, sem innerHTML."],
            ["Gate de admin na UI", "Layout.tsx:71 e App.tsx:508", "O botão usa a RPC is_current_user_admin. Abrir a view ADMIN sem ser admin não passa nas RPC."],
        ],
        [3.5 * cm, 4.3 * cm, usable - 7.8 * cm],
    ))

    story.append(P("4. Pontos fracos", "h1"))
    story.append(section_rule())
    story.append(bullets([
        "O paywall depende da ordem alfabética de dois triggers BEFORE. O isolamento vê is_licensed ainda verdadeiro e deixa fixedLessons em schedules.data.",
        "A policy de SELECT da grade não olha a licença. Rejeitar ou expirar o pagamento não apaga a solução já gravada.",
        "O fallback do cliente, em scheduleService.getScheduleSolution, devolve data.fixedLessons se a RPC negar.",
        "Comprovante e anexo aceitam URL HTTPS arbitrária com token=, e o painel abre esse endereço.",
        "A chave PIX de recebimento tem fallback fixo quando VITE_PIX_KEY não existe no build.",
    ]))

    story.append(P("5. Cobertura", "h1"))
    story.append(section_rule())
    story.append(make_table(
        ["Categoria", "Escopo analisado", "Controles encontrados", "Itens", "Achados", "Cobertura"],
        [
            ["Isolamento", "7 tabelas, policies, triggers, 10 RPC, 2 buckets", "RLS por user_id e is_admin(); pasta do Storage", "Tabelas, RPC e jobs", "0", "Integral"],
            ["Autorização", "Gates isAdmin, isLicensed e activeLicenseStatus cruzados com RPC e RLS", "is_admin() nas RPC; trigger de is_licensed; máscara no React", "Admin, paywall, aprovação e tickets", "2", "Integral"],
            ["IDOR", "Todos os acessos .from, .rpc e .storage nos services e páginas", "Filtro user_id no cliente e RLS no banco", "27 operações e 10 RPC", "1", "Integral"],
            ["Secrets", "Fonte, .env.example, vercel.json e histórico Git", "Placeholders no arquivo atual; sem service_role", "Árvore atual e .env.example", "1", "Integral"],
            ["XSS / URLs", "innerHTML, href, src, iframe e HTML de e-mail", "React escapa texto; getSafeHttpsUrl bloqueia esquemas", "UI, avisos, comprovantes e anexos", "1", "Integral"],
        ],
        [2.35 * cm, 3.5 * cm, 3.7 * cm, 2.5 * cm, 1.5 * cm, 2.15 * cm],
    ))
    story.append(Spacer(1, 8))
    story.append(P(
        "Não aplicável como superfície separada: Docker, docker-compose, Helm, Kubernetes, Terraform e CI/CD. "
        "Motivo: não existem nesses formatos no repositório. O deploy descrito é o header de vercel.json sobre o build estático.",
        "body",
    ))
    story.append(P("<b>Analisado e não contabilizado</b>", "h2"))
    story.append(bullets([
        "public.profiles possui SELECT para authenticated com USING (true) em schema.sql:28. Não há INSERT, trigger nem escrita dessa tabela no repositório, então não há cadeia até dado de outro usuário.",
        "O commit a5db3e7 gravou em .env.example a URL do projeto Supabase e um JWT cujo papel é anon. O arquivo atual voltou a placeholders no commit 1962d12. A chave anon é a mesma classe de credencial pública do bundle e não eleva privilégio. O valor não é reproduzido aqui. Convém rotacioná-la se aquele projeto ainda estiver ativo.",
        "App.tsx:508 renderiza a área admin sem um if isAdmin. As RPC e a RLS recusam o usuário comum. Esconder o botão não é o controle, e o controle de servidor existe.",
        "Content-Security-Policy em vercel.json usa script-src 'unsafe-inline'. Não há sink HTML controlado pelo usuário que torne isso explorável.",
    ]))

    story.append(P("6. Matriz de ownership", "h1"))
    story.append(section_rule())
    story.append(P(
        "Não há handlers HTTP locais. Cada linha é uma operação que o navegador pode chamar com a chave anon e o JWT do usuário. "
        "“OK” significa que a RLS ou a RPC barra o objeto de outro usuário antes da operação sensível."
    ))
    idor_rows = [
        ["scheduleService.<br/>getSchedules", "schedules + licenses", "OK — filtro user_id e RLS"],
        ["scheduleService.<br/>getScheduleSolution", "RPC e fallback em schedules.data", "RPC OK; fallback devolve aulas se ainda estiverem em data"],
        ["scheduleService.<br/>saveSchedule", "schedules por id", "Dono OK; paywall falha na ordem dos triggers"],
        ["scheduleService.<br/>delete, restore, purge e trash", "schedules por id", "OK — filtro user_id e RLS"],
        ["adminLicenseService.<br/>getAllLicenses", "get_admin_licenses", "OK — is_admin()"],
        ["adminLicenseService.<br/>approveLicense", "approve_license_rpc", "OK — is_admin()"],
        ["adminLicenseService.<br/>rejectLicense", "UPDATE licenses por id", "OK — RLS só admin"],
        ["adminLicenseService.<br/>deleteLicense", "delete_license_rpc", "OK — is_admin()"],
        ["adminLicenseService.<br/>getPendingCount", "COUNT licenses", "OK — RLS limita ao próprio usuário"],
        ["adminLicenseService.<br/>getReceiptSignedUrl", "storage receipts", "Dono da pasta OK; URL https com token= passa direto"],
        ["ticketService.<br/>createTicket", "tickets + storage", "user_id OK; image_url não é validada no banco"],
        ["ticketService.<br/>getAllTickets", "get_admin_tickets ou SELECT", "OK — RPC de admin; fallback limitado pela RLS"],
        ["ticketService.<br/>getUserTickets", "tickets", "OK — filtro user_id e RLS"],
        ["ticketService.<br/>updateTicketStatus", "RPC ou UPDATE", "OK — is_admin() e policy de admin"],
        ["ticketService.<br/>getAttachmentSignedUrl", "storage ou URL pronta", "URL http(s) com token= é devolvida sem allowlist"],
        ["notificationService.<br/>get, count e mark", "notifications", "OK — RLS e trigger de conteúdo"],
        ["notificationService.<br/>createNotification", "send_admin_notification", "OK — is_admin()"],
        ["auditLogService.<br/>getMyAuditLogs", "audit_logs", "OK — filtro user_id e RLS"],
        ["PlansPage.<br/>handleUploadReceipt", "storage + request_license_order", "Preço e dono da grade OK; caminho do arquivo não exige a pasta do uid"],
        ["LicenseSelection e App.loadLicenseStatus", "licenses", "OK — .eq(user_id) e RLS"],
        ["Storage receipts e tickets", "storage.objects", "OK para arquivo na pasta do uid"],
    ]
    story.append(make_table(
        ["Operação", "Objeto", "Ownership"],
        idor_rows,
        [5.6 * cm, 4.2 * cm, usable - 9.8 * cm],
    ))

    story.append(P("7. Achados detalhados", "h1"))
    story.append(section_rule())
    story.append(make_table(
        ["Severidade", "Arquivo:linha", "Descrição"],
        [
            [chip("ALTA"), "schema.sql:166 e schema.sql:175", "Trigger de isolamento roda antes do trigger que zera is_licensed e grava a solução sem licença."],
            [chip("MÉDIA"), "schema.sql:99 e adminLicenseService.ts:166", "SELECT da grade não exige licença vigente. Rejeitar o pagamento não apaga fixedLessons."],
            [chip("MÉDIA"), "schema.sql:647 e ticketService.ts:88", "Comprovante e anexo aceitam URL HTTPS arbitrária aberta pelo administrador."],
            [chip("BAIXA"), "schema.sql:647", "O caminho do comprovante não precisa estar na pasta auth.uid()."],
            [chip("BAIXA"), "pages/PlansPage.tsx:41", "Sem VITE_PIX_KEY, o PIX de cobrança usa um e-mail fixo."],
        ],
        [2.5 * cm, 5.3 * cm, usable - 7.8 * cm],
    ))

    story.extend(finding_block(
        1,
        "[ALTA] Paywall contornável pela ordem dos triggers",
        [
            ("Categoria", "Autorização. O dado é do próprio usuário; o que falta é a licença."),
            ("Arquivo:linha", "schema.sql:166 (decisão de manter as aulas) e schema.sql:175 (trigger criado depois, porém com nome que roda antes)."),
            ("Fluxo", "Usuário autenticado faz INSERT ou UPDATE em public.schedules com is_licensed verdadeiro e data.fixedLessons preenchido. No PostgreSQL, triggers BEFORE do mesmo evento disparam em ordem alfabética do nome. trg_isolate_schedule_solution executa antes de trg_protect_schedule_license. O isolamento vê a licença ainda verdadeira, copia as aulas e não remove a chave do JSON. O segundo trigger então força is_licensed para falso, tarde demais."),
            ("Por que é vulnerável", "O flag que deveria ser sempre falso para não admin ainda é verdadeiro no momento em que a solução é preservada. A policy de SELECT devolve data ao dono. A chave anon do bundle torna essa chamada direta possível, fora da máscara do React."),
            ("Quem explora", "Qualquer conta autenticada, inclusive cadastro aberto por authService.signUp."),
            ("Pré-condições", "schema.sql aplicado como está, com os dois nomes de trigger atuais. Não exige ser admin nem ter pagamento aprovado."),
            ("Impacto", "A solução horária, que o schema trata como conteúdo pago, fica armazenada e legível em schedules.data sem licença. O retorno do próprio INSERT já pode trazer o JSON."),
            ("Controles considerados", "protect_schedule_license_status realmente zera o flag. A RLS impede ler a grade de outro usuário. schedule_solutions não é legível pelo usuário. getSchedules no React zera fixedLessons quando isLicensed é falso. Nenhum desses apaga o JSON já gravado nem impede o SELECT direto."),
            ("Correção", "Remover fixedLessons de schedules.data sempre, para não admin, sem consultar is_licensed. Ou nomear e ordenar o trigger de proteção para rodar primeiro. Não devolver a solução por SELECT da tabela; manter só a RPC."),
        ],
        "IF NOT COALESCE(NEW.is_licensed, false) THEN\n"
        "    NEW.data := NEW.data - 'fixedLessons';\n"
        "END IF;\n"
        "-- schema.sql:166\n"
        "CREATE TRIGGER trg_isolate_schedule_solution  -- roda antes\n"
        "CREATE TRIGGER trg_protect_schedule_license   -- roda depois",
    ))
    story.append(P(
        "O cliente amplia o efeito em services/scheduleService.ts:122-132: se a RPC get_schedule_solution falha, o código lê schedules.data.fixedLessons e devolve o array. A RPC em si, nas linhas 700-719, recusa quem não tem licença.",
        "body",
    ))

    story.extend(finding_block(
        2,
        "[MÉDIA] Solução continua legível depois da revogação",
        [
            ("Categoria", "Autorização."),
            ("Arquivo:linha", "schema.sql:99-100 e services/adminLicenseService.ts:164-167."),
            ("Fluxo", "Uma licença já aprovada deixa is_licensed verdadeiro. Nesse estado o trigger de isolamento mantém fixedLessons dentro de data. rejectLicense só executa UPDATE em licenses (status Rejeitado, valid_until nulo). Nada atualiza schedules.is_licensed nem remove a chave JSON. A policy de SELECT continua true para o dono. get_schedule_solution até zera is_licensed, mas só se alguém chamar essa RPC."),
            ("Por que é vulnerável", "Expirar ou rejeitar o pagamento não é o caminho de leitura. Quem já teve a licença ligada continua podendo selecionar a coluna data."),
            ("Quem explora", "O próprio titular da grade, autenticado."),
            ("Pré-condições", "A flag is_licensed chegou a ser verdadeira e um save ocorreu nesse estado. Não serve para quem nunca foi licenciado se o achado 1 estiver corrigido."),
            ("Impacto", "Acesso contínuo ao conteúdo pago após rejeição ou vencimento, até que a RPC de paywall seja executada."),
            ("Controles considerados", "A RPC de leitura recusa licença vencida e pode limpar a flag. O React também esconde as aulas. Os dois dependem de serem o caminho usado."),
            ("Correção", "Na rejeição e no vencimento, gravar is_licensed falso e retirar fixedLessons de data. Não guardar a solução nessa coluna."),
        ],
        "-- schema.sql:99\n"
        "FOR SELECT TO authenticated\n"
        "USING (auth.uid() = user_id OR public.is_admin());\n\n"
        "-- adminLicenseService.ts:164\n"
        ".from('licenses')\n"
        ".update({ payment_status: 'Rejeitado', valid_until: null })\n"
        ".eq('id', licenseId);",
    ))

    story.extend(finding_block(
        3,
        "[MÉDIA] URL de comprovante e de anexo sem allowlist de host",
        [
            ("Categoria", "XSS / URLs controladas pelo usuário."),
            ("Arquivo:linha", "schema.sql:647-649, services/ticketService.ts:88-89, services/adminLicenseService.ts:266-268, pages/AdminPanelPage.tsx:531 e 548."),
            ("Fluxo", "request_license_order aceita p_receipt_path se casar com um UUID interno ou com qualquer host HTTPS no formato /storage/v1/object/(public|sign)/receipts/. A tabela tickets não tem CHECK em image_url; o INSERT do usuário grava o valor. getReceiptSignedUrl devolve a URL quando ela é HTTPS e contém token=. getAttachmentSignedUrl devolve qualquer URL que comece com http e contenha token=. O painel coloca o resultado em href e, se o pathname terminar em .pdf, em iframe src."),
            ("Por que é vulnerável", "O esquema javascript: é bloqueado, então não há execução de script na origem do Horium. O host, porém, não é limitado ao projeto Supabase. O administrador que abre o comprovante navega para a página escolhida pelo solicitante."),
            ("Quem explora", "Usuário autenticado contra o administrador que revisa o pedido ou o chamado."),
            ("Pré-condições", "Conta autenticada. Para o iframe e a imagem, a CSP de vercel.json restringe frame-src e img-src a *.supabase.co. O link “Abrir em nova aba” não é coberto por frame-src."),
            ("Impacto", "Phishing do administrador no momento em que ele confere um pagamento. Não é tomada de sessão por XSS."),
            ("Controles considerados", "getSafeHttpsUrl, regex de storage, sandbox do iframe (sem allow-scripts) e CSP. Eles barram script e esquema perigoso. Não barram a navegação HTTPS."),
            ("Correção", "Aceitar só caminho relativo na pasta do uid, no bucket privado. Assinar a URL no servidor. Recusar URL absoluta gravada pelo cliente."),
        ],
        "-- schema.sql:647\n"
        "p_receipt_path ~* '^https://[a-zA-Z0-9\\.\\-]+/storage/v1/object/(public|sign)/receipts/.+'\n\n"
        "-- ticketService.ts:88\n"
        "if (pathOrUrl.startsWith('http') && pathOrUrl.includes('token=')) {\n"
        "    return pathOrUrl;\n"
        "}",
    ))

    story.extend(finding_block(
        4,
        "[BAIXA] Comprovante pode apontar para a pasta de outro usuário",
        [
            ("Categoria", "IDOR / ownership."),
            ("Arquivo:linha", "schema.sql:646-653."),
            ("Fluxo", "p_receipt_path no formato uuid/arquivo.ext é aceito sem comparar o uuid com auth.uid(). O pedido de licença fica associado a esse caminho. Quem faz o upload para o bucket continua preso à própria pasta. Quem abre o arquivo pelo Storage também. O efeito é gravar, no pedido do atacante, a referência do arquivo de outra pessoa."),
            ("Por que é vulnerável", "A validação confere o formato e não o dono."),
            ("Quem explora", "Usuário autenticado que já conhece o caminho completo do objeto."),
            ("Pré-condições", "O nome do arquivo inclui Date.now() e randomUUID() em PlansPage.tsx:100. Sem vazamento desse caminho, a referência não é adivinhável. O atacante não ganha leitura nova: a policy de SELECT do Storage continua valendo."),
            ("Impacto", "Atribuição indevida de um comprovante alheio a um pedido, se o caminho for conhecido. Severidade baixa por causa dessa pré-condição."),
            ("Controles considerados", "Policy de upload e de leitura do bucket. Elas impedem ler o arquivo, não impedem citar o caminho."),
            ("Correção", "Exigir que a primeira pasta seja auth.uid()::text e que o objeto exista nesse prefixo."),
        ],
        "IF NOT (\n"
        "    p_receipt_path ~* '^[0-9a-f]{8}-.../[a-zA-Z0-9_\\.\\-]+\\.(png|jpe?g|webp|pdf)$'\n"
        "    OR p_receipt_path ~* '^https://.../receipts/.+'\n"
        ") THEN\n"
        "    RAISE EXCEPTION 'Caminho de comprovante inválido ou inseguro.';\n"
        "END IF;",
    ))

    story.extend(finding_block(
        5,
        "[BAIXA] Chave PIX efetiva quando a variável de ambiente falta",
        [
            ("Categoria", "Secrets — default inseguro."),
            ("Arquivo:linha", "pages/PlansPage.tsx:41."),
            ("Fluxo", "generatePixPayload recebe import.meta.env.VITE_PIX_KEY ou, se o valor é vazio, a string horium.app@gmail.com. Esse endereço também aparece nos termos como e-mail de suporte. O QR e o copia-e-cola são montados no navegador."),
            ("Por que é vulnerável", "Não é uma chave de API nem um segredo de banco. É um identificador de recebimento que passa a valer sozinho quando o build esquece VITE_PIX_KEY. Não há falha de inicialização."),
            ("Quem explora", "Não há atacante remoto lendo um segredo privilegiado. O risco é operacional: cobranças do ambiente sem a variável seguem para esse identificador, e o valor fica no bundle."),
            ("Pré-condições", "Build em que VITE_PIX_KEY não foi definida. Com a variável preenchida, o fallback não entra no payload."),
            ("Impacto", "Destino de pagamento diferente do configurado, limitado a esse esquecimento. A chave anon histórica não entra neste achado."),
            ("Controles considerados", ".env.example atual pede um placeholder. Isso não impede o fallback no código."),
            ("Correção", "Se VITE_PIX_KEY estiver ausente, não gerar cobrança. Falhar o build ou a tela de pagamento."),
        ],
        "generatePixPayload(\n"
        "  import.meta.env.VITE_PIX_KEY || 'horium.app@gmail.com',\n"
        "  totalPrice\n"
        ")",
    ))

    story.append(P("8. Recomendações", "h1"))
    story.append(section_rule())
    story.append(make_table(
        ["Ordem", "Ação", "Risco que reduz", "Esforço"],
        [
            ["P1", "Isolar fixedLessons sem olhar is_licensed e impedir que schedules.data guarde a solução.", "Achado alto. Também corta o fallback do cliente.", "Médio"],
            ["P2", "Na rejeição e no vencimento, limpar is_licensed e a solução. Fazer o SELECT não ser o canal da grade paga.", "Achado médio de revogação.", "Médio"],
            ["P3", "Gravar só caminho relativo do próprio usuário e assinar URL no momento da leitura.", "Achados de URL e de pasta do comprovante.", "Baixo"],
            ["P4", "Interromper a tela de PIX quando VITE_PIX_KEY não existir.", "Fallback de recebimento.", "Baixo"],
            ["P5", "Se o projeto phaonqtkhvqkqymqbfjn ainda existir, rotacionar a chave anon publicada no commit a5db3e7.", "Higiene. Não é achado contado: o papel do JWT é anon.", "Baixo"],
        ],
        [1.5 * cm, 8.4 * cm, 4.6 * cm, 2.2 * cm],
    ))

    story.append(PageBreak())
    story.append(P("9. Issues para o GitHub", "h1"))
    story.append(section_rule())
    story.append(P(
        "Cada bloco abaixo está pronto para colar em uma issue. Observações informativas, incluindo a chave anon histórica, não geraram issue."
    ))

    issues = [
        (
            "1",
            """--- ISSUE 1 ---
# [Segurança] Paywall da grade é contornado pela ordem dos triggers

Labels sugeridas: security, alta

## Descrição
Em `schema.sql`, `trg_isolate_schedule_solution` roda antes de `trg_protect_schedule_license` porque triggers BEFORE disparam em ordem alfabética. O isolamento decide manter `fixedLessons` enquanto `is_licensed` ainda é verdadeiro. O trigger seguinte zera a flag para quem não é admin. A solução permanece em `schedules.data` e o dono a lê pelo SELECT.

## Por que é explorável
Qualquer usuário autenticado pode inserir ou atualizar a própria grade enviando `is_licensed: true` e `data.fixedLessons`. A chave anon do cliente torna essa chamada direta. Não depende da tela React, que até mascara o campo.

## Evidência
INSERT/UPDATE do próprio usuário → trigger de isolamento (schema.sql:166) mantém o JSON → trigger de licença (schema.sql:108) zera só a flag → policy de SELECT (schema.sql:99) devolve `data`.

## Arquivo:linha
schema.sql:166
schema.sql:175
services/scheduleService.ts:122

## Trecho de código
```
IF NOT COALESCE(NEW.is_licensed, false) THEN
    NEW.data := NEW.data - 'fixedLessons';
END IF;
```

## Impacto
A solução horária paga fica armazenada e legível sem licença aprovada.

## Sugestão de correção
Retirar `fixedLessons` de `schedules.data` para todo não admin, independente de `is_licensed`. Garantir que o trigger de proteção rode primeiro ou fundir os dois. Remover o fallback que lê `data.fixedLessons` em `getScheduleSolution`.

## Critérios de aceite
- INSERT e UPDATE com `is_licensed = true` feitos por não admin persistem `is_licensed = false` e `data` sem a chave `fixedLessons`.
- SELECT da própria grade sem licença aprovada não devolve aulas alocadas.
- `get_schedule_solution` continua recusando grade sem licença vigente.
- Teste de banco cobre a ordem dos triggers.
--- FIM ISSUE 1 ---""",
        ),
        (
            "2",
            """--- ISSUE 2 ---
# [Segurança] Rejeitar ou vencer a licença não remove a solução já gravada

Labels sugeridas: security, média

## Descrição
A policy de SELECT de `schedules` libera a linha inteira ao dono. `rejectLicense` só altera `licenses`. `is_licensed` e `data.fixedLessons` permanecem. A limpeza existe apenas dentro de `get_schedule_solution`, se essa RPC for chamada.

## Por que é explorável
O titular autenticado, depois de ter tido `is_licensed` verdadeiro, consulta `schedules` pela API e lê `data` sem passar pela RPC de paywall.

## Evidência
Aprovação grava `is_licensed = true` → save mantém as aulas no JSON → rejeição em adminLicenseService.ts:164 não mexe na grade → SELECT em schema.sql:99 devolve `data`.

## Arquivo:linha
schema.sql:99
services/adminLicenseService.ts:164
schema.sql:713

## Trecho de código
```
.from('licenses')
.update({ payment_status: 'Rejeitado', valid_until: null })
.eq('id', licenseId);
```

## Impacto
Conteúdo pago continua disponível ao titular após rejeição ou vencimento, até alguém invocar a RPC.

## Sugestão de correção
Ao rejeitar e ao detectar vencimento, atualizar a grade: `is_licensed = false` e remover `fixedLessons` de `data`. Não usar `schedules.data` como cópia da solução.

## Critérios de aceite
- Depois de `rejectLicense`, SELECT do dono não contém `fixedLessons`.
- Licença com `valid_until` anterior a hoje não deixa a solução legível por SELECT, mesmo sem chamar a RPC.
- A RPC de paywall segue recusando esse caso.
--- FIM ISSUE 2 ---""",
        ),
        (
            "3",
            """--- ISSUE 3 ---
# [Segurança] Comprovante e anexo aceitam URL HTTPS arbitrária

Labels sugeridas: security, média

## Descrição
`request_license_order` aceita um HTTPS qualquer no formato de objeto do Storage. `tickets.image_url` não tem CHECK. Os serviços devolvem a URL quando ela contém `token=`, e o painel admin coloca o valor em link e em iframe.

## Por que é explorável
Um usuário autenticado grava a URL no próprio pedido ou chamado. O administrador, ao conferir o documento, abre o host escolhido pelo usuário. `javascript:` é bloqueado; o problema é o host.

## Evidência
RPC schema.sql:647 → coluna receipt_url ou image_url → getReceiptSignedUrl / getAttachmentSignedUrl → AdminPanelPage.tsx:531 (href) e :548 (iframe).

## Arquivo:linha
schema.sql:647
services/ticketService.ts:88
services/adminLicenseService.ts:266
pages/AdminPanelPage.tsx:531

## Trecho de código
```
if (pathOrUrl.startsWith('http') && pathOrUrl.includes('token=')) {
    return pathOrUrl;
}
```

## Impacto
Phishing do administrador na revisão do pagamento ou do chamado. A CSP limita imagem e iframe a *.supabase.co; o link em nova aba não.

## Sugestão de correção
Persistir somente caminho relativo. Na leitura, gerar signed URL do bucket. Recusar URL absoluta.

## Critérios de aceite
- RPC e INSERT de ticket recusam `https://` externo e `javascript:`.
- O visualizador só recebe signed URL do bucket do projeto.
- Teste com host externo não abre href nem iframe.
--- FIM ISSUE 3 ---""",
        ),
        (
            "4",
            """--- ISSUE 4 ---
# [Segurança] Caminho do comprovante não é amarrado ao usuário autenticado

Labels sugeridas: security, baixa

## Descrição
A regex de `p_receipt_path` aceita qualquer UUID como primeira pasta. Não compara essa pasta com `auth.uid()`.

## Por que é explorável
Se o caminho de um objeto alheio for conhecido, o atacante referencia esse objeto no próprio pedido. A leitura do arquivo continua limitada pela policy do Storage. O nome gerado em PlansPage usa timestamp e UUID, então não é adivinhável.

## Evidência
request_license_order schema.sql:646-653 valida formato e grava `receipt_url` sem checar o prefixo.

## Arquivo:linha
schema.sql:647

## Trecho de código
```
p_receipt_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9_\\.\\-]+\\.(png|jpe?g|webp|pdf)$'
```

## Impacto
Associação do comprovante de outra pessoa a um pedido, condicionada ao conhecimento do caminho. Sem leitura nova do arquivo.

## Sugestão de correção
Exigir `(storage.foldername(p_receipt_path))[1] = auth.uid()::text` e a existência do objeto nessa pasta.

## Critérios de aceite
- Caminho com UUID diferente de `auth.uid()` é recusado.
- Caminho na pasta do próprio usuário continua aceito.
- URL absoluta continua recusada pelo critério da issue 3.
--- FIM ISSUE 4 ---""",
        ),
        (
            "5",
            """--- ISSUE 5 ---
# [Segurança] PIX de cobrança usa identificador fixo se a variável não existir

Labels sugeridas: security, baixa

## Descrição
`PlansPage` gera o payload PIX com `VITE_PIX_KEY` ou, em ausência, `horium.app@gmail.com`.

## Por que é explorável
Não é roubo de credencial. Em um build sem a variável, a cobrança exibida ao usuário aponta para esse identificador, que também está no código-fonte.

## Evidência
pages/PlansPage.tsx:41 passa o fallback para `generatePixPayload`.

## Arquivo:linha
pages/PlansPage.tsx:41

## Trecho de código
```
generatePixPayload(import.meta.env.VITE_PIX_KEY || 'horium.app@gmail.com', totalPrice)
```

## Impacto
Pagamentos do ambiente mal configurado seguem para o identificador embutido. Sem a variável ausente, o fallback não é usado.

## Sugestão de correção
Não montar QR nem copia-e-cola quando `VITE_PIX_KEY` estiver vazio. Tratar isso como erro de configuração.

## Critérios de aceite
- Build sem `VITE_PIX_KEY` não gera payload PIX.
- Build com a variável usa somente esse valor.
- O identificador fixo deixa de aparecer no bundle.
--- FIM ISSUE 5 ---""",
        ),
    ]

    for _num, body in issues:
        story.append(Spacer(1, 8))
        story.append(code_block(body.strip("\n")))

    story.append(Spacer(1, 12))
    story.append(P(
        "Fim do relatório. Cinco achados confirmados, cinco issues acionáveis, nenhuma categoria deixada sem análise.",
        "small",
    ))
    return story


def main() -> None:
    global S
    register_fonts()
    S = styles()
    donut, bars = build_charts()
    frame = Frame(
        MARGIN,
        1.35 * cm,
        PAGE_W - 2 * MARGIN,
        PAGE_H - 2.7 * cm,
        id="body",
        showBoundary=0,
    )
    cover_frame = Frame(
        MARGIN,
        4.6 * cm,
        PAGE_W - 2 * MARGIN,
        PAGE_H - 6.2 * cm,
        id="cover",
        showBoundary=0,
    )
    doc = BaseDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        title="Relatório de Auditoria de Segurança — Horium",
        author="Auditoria estática Horium",
    )
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover),
            PageTemplate(id="body", frames=[frame], onPage=draw_header_footer),
        ]
    )
    doc.build(build_story(donut, bars))
    print(PDF_PATH)


if __name__ == "__main__":
    main()
