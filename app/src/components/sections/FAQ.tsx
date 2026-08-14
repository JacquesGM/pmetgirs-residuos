import { Section } from '../ui/Section';

const perguntas = [
  {
    pergunta: 'O que é o PMetGIRS?',
    resposta:
      'O plano de gestão de resíduos sólidos dos 22 municípios da Região Metropolitana, coordenado pelo IRM. Foi elaborado em 2024, com base em três estudos técnicos.',
  },
  {
    pergunta: 'Quais municípios participam?',
    resposta:
      'Os 22 municípios da Região Metropolitana, definidos pela Lei Complementar nº 184/2018. Veja a lista completa em Municípios.',
  },
  {
    pergunta: 'O plano já está em execução?',
    resposta:
      'Os estudos técnicos foram concluídos em 2024. A implementação está começando: a maioria dos projetos ainda não foi iniciada. Veja a situação de cada um em Projetos.',
  },
  {
    pergunta: 'As usinas foram construídas?',
    resposta: 'Não. As usinas listadas em Infraestrutura planejada ainda são planejamento; nenhuma foi construída.',
  },
  {
    pergunta: 'Os valores são definitivos?',
    resposta:
      'Não. Alguns números aparecem diferentes entre os documentos técnicos. Essas divergências ficam marcadas como "Em validação" em Transparência.',
  },
  {
    pergunta: 'Como os dados são atualizados?',
    resposta: 'Com base nos três estudos técnicos do PMetGIRS (ENGECONSULT, 2024). O histórico de atualizações está em Transparência.',
  },
  {
    pergunta: 'Qual o papel do IRM?',
    resposta:
      'O IRM é a autoridade executiva da Região Metropolitana, criada pela Lei Complementar nº 184/2018. Coordena a elaboração e a implantação do PMetGIRS com os municípios.',
  },
  {
    pergunta: 'Como acompanhar projetos, acessar documentos ou comunicar erros?',
    resposta:
      'Projetos: veja e filtre em Projetos. Documentos: estão em Documentos. Para reportar um erro, use os contatos do IRM no rodapé.',
  },
];

export function FAQ() {
  return (
    <Section
      headingLevel={1}
      id="faq"
      title="Perguntas frequentes"
      subtitle="Respostas rápidas para as dúvidas mais comuns sobre o PMetGIRS."
      tone="muted"
    >
      <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {perguntas.map((item) => (
          <details key={item.pergunta} className="group p-5">
            <summary className="cursor-pointer list-none font-semibold text-neutral-900 marker:content-none">
              <span className="flex items-center justify-between gap-4">
                {item.pergunta}
                <span aria-hidden="true" className="text-brand-blue-600 group-open:rotate-45 transition-transform">
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm text-neutral-600">{item.resposta}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
