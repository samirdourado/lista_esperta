# Identidade visual — Lista Esperta

Fonte: `front_lista_esperta/public/logo_lista_esperta.webp` (999×903) e `icon_lista_esperta.ico` (256×256). **Os arquivos de logo não devem ser alterados nem apagados.**

## Paleta extraída do logo

Média dos pixels opacos de cada região do logo:

| Papel | Região do logo | Medido | Token |
|---|---|---|---|
| **Primária** | corpo e rodas do carrinho, aro do selo | `#0754E0` (≈ 50 % da área colorida) | `--brand` |
| Primária (tom médio) | checks, etiqueta | `#1363F4` | `--brand-strong` (escuro) / hover |
| Primária (brilho) | face clara do carrinho | `#2875FE` | `--brand-bright` |
| **Secundária** | borda da folha da lista | `#9BB6EE` | `--brand-line` |
| Secundária (clara) | linhas da lista | `#C5D4F3` | `--brand-soft` (base) |
| **Destaque** | pin de localização, faíscas | `#FEB204` | `--accent` |
| Neutro | miolo do pin, papel | `#F5F8FE` | `--paper` |
| Tinta | (não está no logo) marinho derivado da primária | `#10224A` | `--ink` |

Os tokens atuais de `globals.css` (`#1a5fe0`, `#ffb400`…) foram ajustados a olho. Na fase 2 eles passam a usar os valores medidos acima.

## Contraste (WCAG 2.x)

| Par | Razão | Uso permitido |
|---|---|---|
| branco sobre `#0754E0` | 6.26 | botão primário, texto normal ✅ AA |
| branco sobre `#1363F4` | 5.10 | hover do botão ✅ AA |
| branco sobre `#2875FE` | 4.15 | só texto grande (≥ 18,66 px negrito) ou decoração |
| `#10224A` sobre `#FEB204` | 8.58 | etiqueta de preço ✅ AAA |
| branco sobre `#FEB204` | 1.81 | ❌ proibido; o amarelo sempre leva tinta escura |
| `#10224A` sobre `#F5F8FE` | 14.63 | texto do corpo ✅ |
| `#0754E0` sobre `#F5F8FE` | 5.89 | links ✅ AA |
| escuro: `#E8EEFC` sobre `#0A1430` | 15.63 | texto do corpo no modo escuro ✅ |
| escuro: `#6B9BFF` sobre `#0A1430` | 6.71 | primária no modo escuro ✅ AA |
| escuro: `#FEB204` sobre `#0A1430` | 10.02 | destaque no modo escuro ✅ |

## Tokens (modo claro / escuro)

| Token | Claro | Escuro |
|---|---|---|
| `--brand` | `#0754E0` | `#6B9BFF` |
| `--brand-strong` | `#1363F4` | `#8EB6FF` |
| `--brand-bright` | `#2875FE` | `#A9C6FF` |
| `--brand-soft` | `#E4ECFD` | `#16284D` |
| `--brand-line` | `#C5D4F3` | `#2A3F6E` |
| `--on-brand` | `#FFFFFF` | `#0A1430` |
| `--accent` | `#FEB204` | `#FEB204` |
| `--accent-soft` | `#FFF3D1` | `#3A2C0C` |
| `--on-accent` | `#10224A` | `#10224A` |
| `--paper` | `#F5F8FE` | `#0A1430` |
| `--surface` | `#FFFFFF` | `#111D3D` |
| `--ink` | `#10224A` | `#E8EEFC` |
| `--ink-soft` | `#46567C` | `#A9B7D8` |
| `--line` | `#D3DDF1` | `#26375F` |
| `--danger` | `#B3261E` | `#F2A49E` |

Regras: o modo escuro segue `prefers-color-scheme`, com override manual por `data-theme="light|dark"` em `<html>`. Todos os tokens são expostos ao Tailwind v4 via `@theme inline` (`bg-brand`, `text-ink` etc.).

## Tipografia

Barlow (texto, 400/500/600) e Barlow Condensed (títulos e preços, 600/700/800), via `next/font/google`. A família já está em uso e combina com o traço arredondado do logo.
