import { Section } from '../ui/Section';

const perguntas = [
  {
    pergunta: 'O que é o PMetGIRS?',
    resposta:
      'É o Plano Metropolitano de Gestão Integrada de Resíduos Sólidos, que organiza o planejamento da gestão de resíduos sólidos para os 22 municípios da Região Metropolitana do Rio de Janeiro, sob coordenação do Instituto Rio Metrópole (IRM). Foi elaborado em 2024 a partir de três estudos técnicos: Diagnóstico Geral, Prognóstico Geral e Plano de Ações.',
  },
  {
    pergunta: 'Quais municípios participam?',
    resposta:
      'Os 22 municípios definidos pela Lei Complementar nº 184/2018 como integrantes da Região Metropolitana do Rio de Janeiro. A lista completa, com dados de cada um, está na seção Mapa da Região Metropolitana.',
  },
  {
    pergunta: 'O plano já está em execução?',
    resposta:
      'O Diagnóstico Geral, o Prognóstico Geral e o Plano de Ações foram concluídos em 2024. A etapa de implementação está em estruturação: a maioria das ações e projetos ainda não foi iniciada. A situação atualizada de cada projeto pode ser consultada na seção Portfólio de Projetos.',
  },
  {
    pergunta: 'As usinas foram construídas?',
    resposta:
      'Não. As usinas de triagem, as unidades térmicas de recuperação energética, as usinas de asfalto e a unidade de biodigestão listadas na seção Infraestrutura planejada são infraestrutura prevista pelo Plano de Ações e pelo Prognóstico Geral — nenhuma delas está construída ou em operação até o momento.',
  },
  {
    pergunta: 'Os valores são definitivos?',
    resposta:
      'Não. Vários números — como a geração diária de resíduos, a distribuição das unidades térmicas e as estimativas de investimento — aparecem com valores diferentes entre os documentos técnicos. Essas divergências são sinalizadas explicitamente como "Em validação" na seção Transparência, em vez de ocultadas ou resolvidas silenciosamente.',
  },
  {
    pergunta: 'Como os dados são atualizados?',
    resposta:
      'Os dados iniciais desta página têm como fonte o Diagnóstico Geral, o Prognóstico Geral e o Plano de Ações do PMetGIRS (ENGECONSULT, 2024). O histórico de cargas e atualizações fica registrado e disponível para consulta na seção Transparência.',
  },
  {
    pergunta: 'Qual o papel do IRM?',
    resposta:
      'O Instituto Rio Metrópole (IRM) é a autoridade executiva da Região Metropolitana do Rio de Janeiro, criada pela Lei Complementar nº 184/2018. Cabe ao IRM coordenar tecnicamente a elaboração, a aprovação e a implantação do PMetGIRS em conjunto com os Conselhos Deliberativo e Consultivo da RMRJ e com as prefeituras dos 22 municípios.',
  },
  {
    pergunta: 'Como acompanhar projetos, acessar documentos ou comunicar erros?',
    resposta:
      'Os projetos podem ser acompanhados e filtrados na seção Portfólio de Projetos. Os documentos técnicos oficiais estão disponíveis na seção Documentos oficiais. Para comunicar um erro ou dado desatualizado, utilize os canais de contato do IRM listados no rodapé desta página.',
  },
];

export function FAQ() {
  return (
    <Section
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
