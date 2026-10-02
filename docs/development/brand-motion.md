# Movimento da marca compartilhado

## Objetivo

Disponibilizar a composição geométrica em `@precisa-saude/ui/brand` para a
homepage, FHIR Brasil, MedBench Brasil e DataSUS Viz. A biblioteca contém apenas
geometria e comportamento; retratos continuam nos projetos consumidores.

## Plano

- [x] Criar worktrees separados de tooling e platform a partir de main.
- [x] Extrair o gerador determinístico e expor um componente React sem dependências novas.
- [x] Usar uma posição de tempo única que possa voltar pelo mesmo percurso.
- [x] Escalonar pontos individualmente, deslizar blocos e dar profundidade própria aos trilhos.
- [x] Aplicar grão estático somente aos planos sólidos grandes.
- [x] Integrar a homepage por importação e validar no localhost.
- [x] Validar reversão, movimento reduzido, limpeza dos observadores, SSR e build.
- [x] Documentar consumo e ordem de publicação, sem publicar neste trabalho.

## Entrega

Entrada e saída compartilham posição, duração e curva por elemento; inverter
durante uma transição conserva a continuidade. Não há timers para cada ponto.
O controlador escreve apenas atributos SVG e dorme quando está parado. Scroll
e resize são agrupados em requestAnimationFrame; aba oculta suspende o relógio.
`prefers-reduced-motion` mostra o estado final sem parallax.

Validação concluída: 9 testes da biblioteca, 97,69% das linhas, 94,41% dos ramos
e 97,56% das funções cobertos. A integração local passou 59 testes e o build
completo da landing. Publicação e atualização dos lockfiles consumidores ficam
para a entrega coordenada; nenhuma versão foi publicada neste trabalho.
