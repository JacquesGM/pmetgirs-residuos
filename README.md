# PMetGIRS

Plataforma do Plano Metropolitano de Gestão Integrada de Resíduos Sólidos da Região Metropolitana do
Rio de Janeiro, do Instituto Rio Metrópole (IRM).

Uma aplicação, duas superfícies:

| Superfície | Rota | Quem acessa |
| --- | --- | --- |
| **PMetGIRS Transparência** | `/` | Qualquer pessoa, sem login |
| **PMetGIRS Gestão** | `/app` | Conta Google convidada |

## Como rodar

Requisitos: Node 20+ e Java 11+ (o emulador do Firestore roda sobre a JVM).

```bash
cd app
npm ci
cp .env.example .env.local
npm run dev                  # http://localhost:5173
```

O portal público funciona sem nenhuma configuração. A área `/app` exige as variáveis de ambiente do
Firebase e informa na tela o que estiver faltando.

Para trabalhar com a área de gestão localmente, sem criar projeto no Firebase:

```bash
npm run emulators            # Auth 9099, Firestore 8080, painel 4000
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e build de produção |
| `npm run test` | Testes de unidade e de componente |
| `npm run test:rules` | Testes das Security Rules contra o Emulator |
| `npm run emulators` | Sobe Auth, Firestore e Hosting locais |
| `npm run bootstrap:owner` | Cria o primeiro proprietário do workspace |

## Antes de commitar

**Nunca versione credenciais.** Chave de service account, chave privada, senha ou token de depuração
não entram em código, `.env`, commit ou mensagem. O `.gitignore` bloqueia os padrões conhecidos e o
CI falha o build se encontrar algum, mas a responsabilidade é de quem escreve.

A configuração web do Firebase (`VITE_FIREBASE_*`) não é segredo — ela vai embutida no bundle que
qualquer visitante baixa e não autoriza nada. Quem protege os dados são as Security Rules, avaliadas
no servidor.

`npm run test:rules` precisa passar antes de qualquer alteração em `firebase/firestore.rules`.

## Estrutura

```
app/
  src/
    app/            casca da gestão, roteador privado, autenticação e guards
    components/     portal público — layout, seções, gráficos e kit de UI
    data/
      firebase/     inicialização do SDK (carregada sob demanda)
      repositories/ contratos de leitura
      static/       adaptadores dos arquivos JSON
      *.json        os dados públicos versionados
    domain/         enums, schemas de validação e conversão dos status legados
    features/auth/  telas de entrada, acesso pendente e acesso suspenso
    lib/            funções puras (exportação CSV/PDF, filtros)
  firebase/
    firestore.rules       autorização
    firestore.indexes.json
    tests/                testes das regras no Emulator
  scripts/
    bootstrap-owner.ts    porta administrativa, execução manual
```

## Documentação

A documentação de arquitetura, segurança, controle de acesso e provisionamento é **interna do
Instituto Rio Metrópole** e não faz parte deste repositório. Ela fica com a equipe do projeto —
procure o responsável técnico para ter acesso.
