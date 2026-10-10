# Segurança dos pacotes e workflows públicos

O código, os templates, a documentação e os tarballs publicados são públicos.
Exemplos devem ser fictícios. Runbooks, topologia de aplicações privadas e
configurações operacionais ficam nos repositórios consumidores. Credenciais
ficam nos mecanismos de segredos apropriados.

## Revisão externa de código

`review.yml` exige `.github/review-policy.json` no **commit base do PR**. Uma
mudança de política dentro do PR só passa a valer após merge. Política ausente,
inválida, falha de leitura ou possível segredo bloqueia o job antes de chamar
qualquer provedor. O workflow não instala nem executa o código do PR.

```json
{
  "enabled": true,
  "provider": "openai",
  "fallbackProviders": [],
  "includePaths": ["packages/**/src/**"],
  "excludePaths": ["**/fixtures/**"],
  "scanForSecretsBeforeSending": true,
  "onSensitiveContent": "block"
}
```

Provedores aceitos: `openai`, `anthropic` e `github-models`. A ordem é o provedor
principal seguido dos fallbacks declarados. Uma chave configurada não autoriza
seu provedor automaticamente. O template começa com `enabled: false`.

Caminhos usam globs Git relativos à raiz, sem prefixos de pathspec, espaços ou
segmentos `..`. O workflow filtra tanto o diff quanto a lista de arquivos.
`exclude_paths` e `REVIEW_EXCLUDE_PATHS` acrescentam exclusões; não ampliam a
política. Arquivos de ambiente, chaves privadas e diretórios `patient-data` e
`exports` têm exclusões mínimas obrigatórias. Renomes são tratados como remoção
e adição para evitar incluir um caminho excluído no diff de outro arquivo.

Uma verificação heurística procura padrões de credenciais no conteúdo completo
selecionado, inclusive linhas removidas, antes de truncar o diff em 150.000
bytes. Ela não identifica todos os segredos ou dados pessoais. A seleção de
caminhos continua sendo responsabilidade do consumidor. Falhas não registram o
conteúdo bloqueado, e respostas de erro dos provedores não são copiadas ao log.
Cada rodada usa o diff completo autorizado entre base e head do PR.

## Permissões e publicação

Checks usam `contents: read`, não recebem segredos e não persistem credenciais
no checkout. Release recebe apenas os segredos do GitHub App. Publicação recebe
`NPM_TOKEN`, leitura de conteúdo e OIDC para proveniência. Review recebe somente
as chaves declaradas em sua interface; a política limita seu uso.

Tanto a publicação normal quanto `publish-tag.yml` passam pelo ambiente
`npm-publish`. Configure revisores obrigatórios no repositório consumidor;
o nome do ambiente, sozinho, não impõe aprovação.

A recuperação manual deve ser disparada na branch padrão. Ela exige uma tag
`vMAJOR.MINOR.PATCH` (com pré-release opcional), uma GitHub Release publicada e
um commit ancestral da branch padrão. O checkout usa o SHA resolvido antes da
aprovação, evitando que uma movimentação posterior da tag altere o código
publicado. A aprovação continua necessária para executar o build desse commit.

## Conteúdo dos pacotes

O build do CLI copia apenas as fontes de `templates.manifest.yml`, o próprio
manifesto e o README. Arquivos extras, fontes ausentes, links simbólicos e
caminhos fora do diretório interrompem o build. Declare novos templates apenas
após revisar se seu conteúdo pode ser público.

Secret scanning e push protection são configurações do GitHub, não efeitos de
um commit. Sua ativação deve ser verificada nas configurações de cada repo.

## Adoção pelos consumidores

Esta mudança de contrato exige uma release principal: chamadas à revisão sem
política passam a falhar. A ordem de adoção é:

1. Adicionar e revisar a política local na branch padrão. É possível começar
   com `enabled: false`. Manter os workflows atuais durante essa etapa.
2. Publicar a nova release do tooling com a aprovação habitual.
3. Atualizar pacotes e pins dos workflows para o SHA publicado via PR. Revisar
   permissões por job, passar somente os segredos necessários e atualizar a
   entrada local de recuperação `publish-tag.yml` com validação e ambiente.
4. Executar o CI do consumidor e revisar a atualização antes do merge.

Consumidores já fixados em versões anteriores mantêm o comportamento anterior
até essa adoção. O CLI gera novos scaffolds com a política desabilitada; não
sobrescreve arquivos existentes. O próprio tooling mantém `enabled: false` em
`.github/review-policy.json` e não chama o job de revisão externa na entrada
local de CI. A remoção dessa chamada impede revisão também na PR que desabilita
a política, enquanto o commit base ainda permite GitHub Models. O workflow
reutilizável continua exigindo autorização na base para os consumidores.

Versões antigas no npm, histórico Git e cópias já baixadas preservam o conteúdo
anterior. A limpeza desta release não remove essas cópias nem confirma ausência
de uso indevido. Remoção histórica e rotação dependem de uma descoberta concreta.
