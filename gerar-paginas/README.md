# gerar-paginas — AI comic studio

Pipeline genérico para gerar edições completas de quadrinhos com IA e empacotar
como `.cbz`. Cada quadrinho é um projeto em `projects/<nome>/` (na raiz do
repo); o primeiro é o **megaman-nam** (_Novas Aventuras de Megaman_ 17–20).

As instruções que o agente segue estão em [SKILL.md](SKILL.md); este arquivo
é a visão geral para humanos. Todos os comandos rodam a partir da raiz do
repo (`<repo>`).

`projects/` está no `.gitignore` (roteiros, refs, renders e `.cbz` gerados —
conteúdo grande e não versionado); o template para novos projetos vive em
[`_template/`](_template/) dentro desta pasta por isso mesmo.

## Arquitetura (e por que é a opção mais barata)

| Papel                    | Ferramenta                                                          | Custo                                      |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| Orquestração + QC visual | **o agente** (Claude Code / Codex, skill `/gerar-paginas`)          | já incluso na assinatura — **sem API LLM** |
| Geração de imagem        | **Higgsfield CLI** — `gpt_image_2_5` low/2k (2 créditos/geração)    | plano Plus: 1000 créditos/mês ≈ 500 gerações |
| Parsing, CBZ, estado     | Scripts Python locais (`scripts/`)                                  | zero                                       |

Orçamento real (medido via `higgsfield generate cost`): uma edição de 30
páginas com ~2,5 tentativas/página ≈ **150 créditos** — as 4 edições do
megaman-nam cabem em um mês de plano Plus com folga. O skill confere o saldo
(`higgsfield account status`) antes de cada lote.

## Setup (uma vez — já feito)

```bash
npm i -g @higgsfield/cli
higgsfield auth login          # login na conta Higgsfield (navegador)
npx skills add higgsfield-ai/skills   # instala os skills higgsfield-* em .agents/skills/
```

Requisito local: `python3` com `Pillow` (o `venv/` criado por `<repo>/setup.sh` serve).

## Uso

```bash
# 1. dividir os roteiros de um projeto em jobs por página (já feito p/ megaman-nam)
python3 gerar-paginas/scripts/split_scripts.py -p megaman-nam

# 2. abrir o agente nesta pasta e rodar:
#    /gerar-paginas megaman-nam 17        → gera+QC as próximas páginas pendentes
#    /gerar-paginas megaman-nam 17 5-10   → páginas específicas

# 3. progresso
python3 gerar-paginas/scripts/status.py

# 4. guia de letreiramento (o texto de cada balão, página a página)
python3 gerar-paginas/scripts/make_lettering_guide.py -p megaman-nam 17
#    → gerar-paginas/projects/megaman-nam/out/lettering_17.md

# 5. quando a edição fechar (depois do letreiramento manual, re-salve as
#    páginas letreiradas em work/17/approved/ antes de montar)
python3 gerar-paginas/scripts/assemble_cbz.py -p megaman-nam 17   # → gerar-paginas/projects/megaman-nam/out/Megaman17.cbz
```

**Letreiramento:** os projetos com `"lettering": "manual"` no project.json
geram as páginas com balões vazios (forma e posição certas, sem nenhum
texto) — os textos são adicionados manualmente depois, seguindo o guia. Para
deixar a IA renderizar os textos, use `"lettering": "ai"`.

Páginas que falharem 3x ficam `needs_review` no `work/<ed>/state.json` do
projeto — revise o motivo, ajuste o roteiro se preciso e rode o skill de novo.

## Scripts

| Script | O que faz |
| --- | --- |
| `scripts/split_scripts.py -p <proj> [ed...]` | roteiro por edição → `projects/<p>/jobs/<ed>/page_NN.json` (+ `work/<ed>/state.json`) |
| `scripts/status.py [-p <proj>]` | progresso (aprovadas / pendentes / needs_review) de todos os projetos |
| `scripts/make_lettering_guide.py -p <proj> <ed>` | guia de letreiramento por edição → `projects/<p>/out/lettering_<ed>.md` |
| `scripts/assemble_cbz.py -p <proj> <ed>` | páginas aprovadas → `projects/<p>/out/*.cbz` (JPEG, altura máx. do project.json) |
| `scripts/common.py` | descoberta de projetos / leitura do project.json (importado pelos outros) |
| `scripts/gen_page.py <proj> <ed> <pág> <try>` | gera UMA página pelo Higgsfield CLI sem o agente (usado pelo `batch_gen.sh`); o skill normalmente chama o CLI direto |
| `scripts/batch_gen.sh <proj> <ed> <pág...>` | lote sequencial em background com log (`work/<ed>/batch.log`) |
| `_template/` | copie para `projects/<nome>/` para começar um quadrinho novo |

## Começar um quadrinho novo

1. Copie `gerar-paginas/_template/` para `projects/<nome-novo>/`.
2. Preencha `PROJECT.md` (fontes, estilo, regras de QC, páginas especiais) e
   `project.json` (edições, padrão dos roteiros, nomes do cbz).
3. Adicione `scripts_src/` (roteiros página a página), `refs/model-sheets/`,
   `refs/style/` e `charmap.json` (use o megaman-nam como referência de formato).
4. `python3 gerar-paginas/scripts/split_scripts.py -p <nome-novo>` e depois
   `/gerar-paginas <nome-novo> <edição>` no agente.

## Projetos

- **megaman-nam** — Novas Aventuras de Megaman 17–20. Detalhes:
  `projects/megaman-nam/PROJECT.md`.
  Roteiros-fonte: `~/Nextcloud/Documents/Reading/Novas Aventuras de
Megaman/Megaman17..20.md` (se editar, re-copiar p/ `scripts_src/` e rodar o
  splitter; o estado das páginas já geradas é preservado).
