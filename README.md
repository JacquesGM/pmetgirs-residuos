# Endereço antigo do PMetGIRS

Este repositório não tem código. Ele existe por um motivo só: manter vivo o
endereço em que o portal morou antes, para que link antigo não morra.

O portal está em **<https://teste-e003c.web.app>**, servido pelo Firebase
Hosting. Antes disso ele foi publicado pelo GitHub Pages, em
`https://jacquesgm.github.io/pmetgirs-residuos/`. Quem guardou aquele endereço
— num favorito, num ofício, num link de outra página — chega aqui, e daqui é
levado ao portal.

## Por que é um repositório separado

O GitHub Pages só publica de repositório **público** em contas do plano
gratuito, e o nome do repositório é o que forma a URL: um repositório chamado
`pmetgirs-residuos` publica em `jacquesgm.github.io/pmetgirs-residuos`.

O código do portal passou a ser privado. Se ele continuasse com este nome, ou o
código ficaria exposto, ou o endereço antigo morreria. Separar preserva os dois:
o código em repositório privado, e aqui apenas o HTML que aponta para o lugar
certo.

Antes desta separação o redirecionamento vivia no ramo `gh-pages` do próprio
repositório de código. Isso funcionava enquanto ele era público — e teria
morrido em silêncio no instante em que deixasse de ser.

## Não apague

Apagar este repositório, torná-lo privado, ou desligar o Pages nas configurações
faz o endereço antigo voltar a responder 404 — silenciosamente, sem quebrar nada
que alguém vá notar. Se um dia o portal mudar de endereço de novo, o que muda
aqui é o destino em `index.html` e `404.html`, não a existência do repositório.

## Como funciona

O GitHub Pages é estático e não emite 301, então a página combina quatro
recursos, do mais confiável ao último recurso: `rel=canonical` para consolidar a
indexação, `meta refresh` para quem está sem JavaScript, um script que preserva
o caminho (`/projetos` cai em `/projetos`, não na home) e um link visível para
quando tudo o mais falhar.

O `404.html` faz o mesmo, e é ele que atende qualquer caminho que não seja a
raiz.

As cores acompanham a rampa do portal — a mesma adotada do Projeto Iguaçu, para
que a página de passagem não pareça de outro sistema.
