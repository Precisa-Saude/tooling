import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { after, it } from 'node:test';
import { parse } from 'yaml';
import { copyTemplates } from '../scripts/copy-templates.mjs';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const work = fs.mkdtempSync(join(tmpdir(), 'tooling-security-'));
after(() => fs.rmSync(work, { recursive: true, force: true }));
const workflow = (name) => parse(fs.readFileSync(join(root, '.github/workflows', name), 'utf8'));
const review = workflow('review.yml');
const inputStep = review.jobs.review.steps.find((step) => step.id === 'pr');
const inputScript = inputStep.run.replace(/^node << 'SCRIPT'\n/, '').replace(/\nSCRIPT\n?$/, '');
const policy = {
  enabled: true,
  provider: 'openai',
  fallbackProviders: [],
  includePaths: ['**'],
  excludePaths: ['private/**'],
  scanForSecretsBeforeSending: true,
  onSensitiveContent: 'block',
};
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
};
const git = (args, input) =>
  execFileSync('git', args, { cwd: work, env: gitEnv, input, encoding: 'utf8' }).trim();
git(['init', '--quiet']);
function commit(files, parent) {
  git(['read-tree', '--empty']);
  for (const [path, content] of Object.entries(files)) {
    const blob = git(['hash-object', '-w', '--stdin'], content);
    git(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`]);
  }
  const tree = git(['write-tree']);
  return git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', 'fixture']);
}
const base = commit({ 'src/ok.ts': 'old\n' });
let runNumber = 0;
function prepare({
  config = policy,
  files = { 'src/ok.ts': 'new\n' },
  missing = false,
  moved = false,
  fetchFailure = false,
} = {}) {
  const head = commit(files, base);
  const dest = join(work, `run-${runNumber++}`);
  fs.mkdirSync(dest);
  const calls = [];
  const localFs = {
    appendFileSync: (path, data) => fs.appendFileSync(join(dest, path), data),
    mkdtempSync: fs.mkdtempSync,
    writeFileSync: (path, data) =>
      fs.writeFileSync(isAbsolute(path) ? path : join(dest, path), data),
  };
  const mockExec = (command, args, options) => {
    calls.push([command, ...args]);
    if (command === 'gh') {
      if (args[1].includes('/contents/')) {
        assert.ok(args[1].endsWith(`?ref=${base}`));
        if (missing) throw new Error('404');
        return JSON.stringify({
          type: 'file',
          encoding: 'base64',
          size: 100,
          content: Buffer.from(JSON.stringify(config)).toString('base64'),
        });
      }
      return JSON.stringify({
        base: { sha: base, repo: { full_name: 'example/repo' } },
        head: { sha: head },
      });
    }
    if (args[0] === 'fetch') {
      if (fetchFailure) throw new Error('PRIVATE OUTPUT THAT MUST NOT BE PRINTED');
      return '';
    }
    if (args[0] === 'rev-parse') return moved ? base : head;
    return execFileSync(command, args, { ...options, cwd: work, env: gitEnv });
  };
  const context = {
    require: (name) =>
      name === 'node:path' ? { join } : name === 'node:fs' ? localFs : { execFileSync: mockExec },
    process: {
      env: {
        PR_NUMBER: '12',
        GITHUB_REPOSITORY: 'example/repo',
        GITHUB_OUTPUT: 'outputs',
        MAX_DIFF_SIZE: '150000',
        RUNNER_TEMP: dest,
      },
    },
    Buffer,
    console: { log() {} },
  };
  return {
    dest,
    calls,
    payload: (name) =>
      join(fs.readFileSync(join(dest, 'outputs'), 'utf8').match(/^input_dir=(.+)$/m)[1], name),
    run: () => vm.runInNewContext(inputScript, context),
  };
}
it('usa a política da base, filtra conteúdo e nomes, inclusive renomes de arquivos excluídos', () => {
  const test = prepare({
    files: {
      'src/ok.ts': 'new\n',
      '.env': 'PRIVATE_ENV',
      'src/.env.local': 'PRIVATE_ENV',
      'private/renamed.ts': 'old\n',
      'docs/exports/table.csv': 'PRIVATE_DATA',
      '.github/review-policy.json': '{"enabled":true,"provider":"anthropic"}',
    },
    config: { ...policy, includePaths: ['src/**', 'private/**', 'docs/**'] },
  });
  test.run();
  assert.equal(fs.readFileSync(test.payload('changed_files.txt'), 'utf8'), 'src/ok.ts');
  const diff = fs.readFileSync(test.payload('pr.diff'), 'utf8');
  assert.match(diff, /new/);
  assert.doesNotMatch(diff, /PRIVATE|renamed|\.env/);
  assert.match(fs.readFileSync(join(test.dest, 'outputs'), 'utf8'), /providers=\["openai"\]/);
});
it('aceita o OpenRouter como provedor autorizado na política', () => {
  const test = prepare({
    files: { 'src/ok.ts': 'new\n' },
    config: { ...policy, provider: 'openrouter', includePaths: ['src/**'] },
  });
  test.run();
  assert.match(fs.readFileSync(join(test.dest, 'outputs'), 'utf8'), /providers=\["openrouter"\]/);
});
it('bloqueia política ausente, inválida ou com tentativa de ampliar pathspec', () => {
  const invalid = [
    null,
    {},
    { ...policy, provider: 'unknown' },
    { ...policy, fallbackProviders: ['unknown'] },
    { ...policy, includePaths: [] },
    { ...policy, includePaths: [':(exclude)private/**'] },
    { ...policy, excludePaths: ['../private'] },
    { ...policy, scanForSecretsBeforeSending: false },
    { ...policy, onSensitiveContent: 'allow' },
    { ...policy, unknown: true },
  ];
  for (const config of invalid) {
    const test = prepare({ config });
    assert.throws(test.run);
    assert.equal(fs.existsSync(join(test.dest, 'pr.diff')), false);
  }
  assert.throws(prepare({ missing: true }).run);
});
it('desabilitar revisão impede preparação do diff e não cria payload', () => {
  const test = prepare({ config: { enabled: false } });
  test.run();
  assert.equal(
    test.calls.some((call) => call[0] === 'git'),
    false,
  );
  assert.equal(fs.readFileSync(join(test.dest, 'outputs'), 'utf8'), 'enabled=false\n');
});
it('segredo além do limite de truncagem bloqueia o payload inteiro sem revelar o valor', () => {
  const secret = 'ghp_' + 'A'.repeat(36);
  const test = prepare({ files: { 'src/ok.ts': 'a'.repeat(160000) + '\n' + secret } });
  assert.throws(
    test.run,
    (error) => /exportação bloqueada/.test(error.message) && !error.message.includes(secret),
  );
  assert.equal(fs.existsSync(join(test.dest, 'pr.diff')), false);
});
it('PR alterado e falha de git bloqueiam a revisão sem incluir a saída privada na exceção', () => {
  assert.throws(prepare({ moved: true }).run, /PR mudou/);
  assert.throws(
    prepare({ fetchFailure: true }).run,
    (error) =>
      /nenhum conteúdo foi transmitido/.test(error.message) && !error.message.includes('PRIVATE'),
  );
});
it('a API recebe apenas os provedores autorizados e steps seguintes exigem payload válido', () => {
  const api = review.jobs.review.steps.find((step) => step.id === 'call');
  assert.equal(api.if, "steps.pr.outputs.enabled == 'true'");
  assert.match(api.run, /const order = JSON.parse\(process.env.REVIEW_PROVIDERS\)/);
  const post = review.jobs.review.steps.find((step) => step.name === 'Post review');
  assert.equal(post.if, "steps.pr.outputs.enabled == 'true'");
  assert.doesNotMatch(post.with.script, /\$\{\{/);
  assert.equal(review.jobs.review['continue-on-error'], undefined);
});
it('checks não recebem segredos ou permissões de escrita; publicação manual usa aprovação e SHA', () => {
  const ci = workflow('ci.yml');
  assert.deepEqual(ci.permissions, { contents: 'read' });
  assert.deepEqual(ci.jobs.checks.permissions, { contents: 'read' });
  assert.equal(ci.jobs.checks.secrets, undefined);
  assert.deepEqual(workflow('_checks.yml').permissions, { contents: 'read' });
  const publish = workflow('publish-tag.yml');
  assert.equal(publish.jobs.publish.environment, 'npm-publish');
  assert.equal(publish.jobs.publish.steps[0].with.ref, '${{ needs.resolve.outputs.sha }}');
  assert.match(publish.jobs.resolve.if, /repository.default_branch/);
});
it('resolução manual recusa refs arbitrárias, drafts e tags fora da branch padrão', async () => {
  const script = workflow('publish-tag.yml').jobs.resolve.steps[0].with.script;
  async function resolveTag(tag, status = 'behind', draft = false, annotated = false) {
    const outputs = {};
    const github = {
      rest: {
        repos: {
          getReleaseByTag: async () => ({ data: { tag_name: tag, draft } }),
          compareCommits: async () => ({ data: { status } }),
        },
        git: {
          getRef: async () => ({
            data: { object: { type: annotated ? 'tag' : 'commit', sha: base } },
          }),
          getTag: async () => ({ data: { object: { type: 'commit', sha: base } } }),
        },
      },
    };
    await vm.runInNewContext(`(async () => { ${script} })()`, {
      process: { env: { RELEASE_TAG: tag } },
      github,
      context: {
        repo: { owner: 'example', repo: 'repo' },
        payload: { repository: { default_branch: 'main' } },
      },
      core: {
        setOutput: (key, value) => {
          outputs[key] = value;
        },
        info() {},
      },
    });
    return outputs;
  }
  assert.equal((await resolveTag('v2.0.0')).sha, base);
  assert.equal((await resolveTag('v2.0.0', 'identical', false, true)).sha, base);
  for (const tag of ['main', '--help', 'v1.0.0;echo bad']) await assert.rejects(resolveTag(tag));
  await assert.rejects(resolveTag('v2.0.0', 'ahead'));
  await assert.rejects(resolveTag('v2.0.0', 'diverged'));
  await assert.rejects(resolveTag('v2.0.0', 'behind', true));
});
it('empacotamento recusa arquivos não declarados, symlinks e traversal sem apagar saída válida', () => {
  const source = join(work, 'templates');
  const dest = join(work, 'dist');
  fs.mkdirSync(source);
  fs.writeFileSync(join(source, 'templates.manifest.yml'), 'templates:\n  - source: example.txt\n');
  fs.writeFileSync(join(source, 'README.md'), 'readme');
  fs.writeFileSync(join(source, 'example.txt'), 'template');
  assert.equal(copyTemplates(source, dest), 3);
  fs.writeFileSync(join(source, '.env'), 'unlisted');
  assert.throws(() => copyTemplates(source, dest), /não declarado/);
  assert.equal(fs.readFileSync(join(dest, 'example.txt'), 'utf8'), 'template');
  fs.unlinkSync(join(source, '.env'));
  fs.unlinkSync(join(source, 'example.txt'));
  fs.symlinkSync(join(source, 'README.md'), join(source, 'example.txt'));
  assert.throws(() => copyTemplates(source, dest), /Link simbólico/);
  fs.writeFileSync(join(source, 'templates.manifest.yml'), 'templates:\n  - source: ../outside\n');
  assert.throws(() => copyTemplates(source, dest), /Caminho/);
});
const callStep = review.jobs.review.steps.find((step) => step.id === 'call');
const callScript = callStep.run.replace(/^node << 'SCRIPT'\n/, '').replace(/\nSCRIPT\n?$/, '');
// Executa o passo "Call approved review providers" com fetch simulado. O
// diretório temporário faz o papel do RUNNER_TEMP, e o artefato de auditoria
// é gravado de verdade para que o teste leia o que seria enviado.
async function runCallStep(env, fetchImpl) {
  const temp = fs.mkdtempSync(join(work, 'call-'));
  const logs = [];
  const outputs = [];
  await vm.runInNewContext(callScript, {
    require: (name) =>
      name === 'node:path'
        ? { join }
        : {
            readFileSync: (path) =>
              path.endsWith('changed_files.txt') ? 'src/a.ts\nsrc/b.ts' : 'allowed diff',
            appendFileSync: (_path, value) => outputs.push(value),
            mkdtempSync: fs.mkdtempSync,
            writeFileSync: fs.writeFileSync,
          },
    process: {
      env: {
        REVIEW_INPUT_DIR: temp,
        RUNNER_TEMP: temp,
        GITHUB_OUTPUT: 'outputs',
        REVIEW_ROUND: '1',
        ...env,
      },
    },
    console: { log: (value) => logs.push(value) },
    fetch: fetchImpl,
  });
  const output = outputs.join('');
  const auditDir = output.match(/audit_dir<<EOF\n(.+)\n/)?.[1];
  const review = join(temp, 'review.json');
  return {
    logs: logs.join('\n'),
    outputs: output,
    auditDir,
    reviewText: fs.existsSync(review) ? fs.readFileSync(review, 'utf8') : null,
  };
}
const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});
it('falha no provedor autorizado não transmite a outro provedor nem registra o corpo do erro', async () => {
  const urls = [];
  const { logs, outputs } = await runCallStep(
    {
      REVIEW_PROVIDERS: '["openai"]',
      OPENAI_API_KEY: 'test-key',
      ANTHROPIC_API_KEY: 'test-key',
      GITHUB_TOKEN: 'test-key',
    },
    async (url) => {
      urls.push(url);
      return jsonResponse(500, { error: { message: 'PRIVATE RESPONSE CONTENT' } });
    },
  );
  assert.deepEqual(urls, ['https://api.openai.com/v1/chat/completions']);
  assert.doesNotMatch(logs + outputs, /PRIVATE RESPONSE CONTENT/);
});
it('OpenRouter recebe a chave própria e o modelo da entrada, e só ele é chamado', async () => {
  const calls = [];
  await runCallStep(
    {
      REVIEW_PROVIDERS: '["openrouter"]',
      OPENROUTER_API_KEY: 'or-key',
      OPENROUTER_MODEL: 'anthropic/claude-sonnet-5.5',
      OPENAI_API_KEY: 'test-key',
      ANTHROPIC_API_KEY: 'test-key',
    },
    async (url, init) => {
      calls.push({ url, auth: init.headers.Authorization, model: JSON.parse(init.body).model });
      return jsonResponse(500, {});
    },
  );
  assert.deepEqual(calls, [
    {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      auth: 'Bearer or-key',
      model: 'anthropic/claude-sonnet-5.5',
    },
  ]);
  const env = review.jobs.review.env;
  assert.match(env.OPENROUTER_MODEL, /inputs\.openrouter_model/);
  assert.ok(review.on.workflow_call.secrets.OPENROUTER_API_KEY);
});
async function runReviewCall(env, respond) {
  const calls = [];
  const result = await runCallStep(env, async (url, init) => {
    calls.push({ url, maxTokens: JSON.parse(init.body).max_tokens });
    return jsonResponse(200, respond(url));
  });
  return { calls, ...result };
}
it('resposta truncada no limite de tokens passa para o próximo provedor autorizado', async () => {
  const valid = '{"summary":"ok","changes":[],"feedback":[]}';
  const { calls, outputs, reviewText } = await runReviewCall(
    {
      REVIEW_PROVIDERS: '["openrouter","anthropic"]',
      OPENROUTER_API_KEY: 'or-key',
      ANTHROPIC_API_KEY: 'test-key',
    },
    (url) =>
      url.includes('openrouter')
        ? { choices: [{ finish_reason: 'length', message: { content: '' } }] }
        : { content: [{ type: 'text', text: valid }], stop_reason: 'end_turn' },
  );
  assert.deepEqual(calls, [
    { url: 'https://openrouter.ai/api/v1/chat/completions', maxTokens: 32000 },
    { url: 'https://api.anthropic.com/v1/messages', maxTokens: 32000 },
  ]);
  assert.match(outputs, /status<<EOF\nok\n/);
  assert.match(outputs, /fell_back<<EOF\ntrue\n/);
  assert.equal(reviewText, valid);
});
it('resposta vazia ou fora do JSON vira erro com motivo, sem revisão em branco', async () => {
  const { calls, outputs, reviewText } = await runReviewCall(
    {
      REVIEW_PROVIDERS: '["openai","github-models","anthropic"]',
      OPENAI_API_KEY: 'test-key',
      GITHUB_TOKEN: 'test-key',
      ANTHROPIC_API_KEY: 'test-key',
    },
    (url) => {
      if (url.includes('openai.com')) {
        return { choices: [{ finish_reason: 'stop', message: { content: '   ' } }] };
      }
      if (url.includes('github.ai')) {
        return { choices: [{ finish_reason: 'stop', message: { content: 'não é JSON' } }] };
      }
      return { content: [{ type: 'text', text: '{"summary":' }], stop_reason: 'max_tokens' };
    },
  );
  assert.deepEqual(
    calls.map((call) => call.maxTokens),
    [16384, 16384, 32000],
  );
  assert.equal(reviewText, null);
  assert.match(outputs, /status<<EOF\nerror\n/);
  assert.match(outputs, /OpenAI: resposta vazia/);
  assert.match(outputs, /GitHub Models: resposta não é um JSON de revisão válido/);
  assert.match(outputs, /Anthropic: resposta truncada no limite de tokens/);
});
it('artefato de auditoria guarda a resposta bruta de cada tentativa, a revisão e o meta, sem diff nem chave', async () => {
  const valid = '{"summary":"ok","changes":[],"feedback":[]}';
  const openrouterKey = 'sk-or-v1-SECRETVALUE-123456';
  const { logs, outputs, auditDir } = await runCallStep(
    {
      REVIEW_PROVIDERS: '["openrouter","openai","github-models","anthropic"]',
      OPENROUTER_API_KEY: openrouterKey,
      OPENAI_API_KEY: 'openai-test-key',
      GITHUB_TOKEN: 'github-test-key',
      ANTHROPIC_API_KEY: 'anthropic-test-key',
      PR_NUMBER: '1067',
      HEAD_SHA: 'a'.repeat(40),
      DIFF_BYTES: '200000',
      DIFF_BYTES_SENT: '150000',
      DIFF_TRUNCATED: 'true',
    },
    async (url) => {
      if (url.includes('openrouter')) {
        return jsonResponse(200, {
          id: 'gen-1',
          model: 'openai/gpt-5.6-terra',
          provider: 'OpenAI',
          choices: [
            {
              finish_reason: 'stop',
              message: { content: ' ', reasoning: 'RACIOCÍNIO DO MODELO' },
            },
          ],
          usage: {
            prompt_tokens: 73489,
            completion_tokens: 812,
            completion_tokens_details: { reasoning_tokens: 640 },
          },
        });
      }
      if (url.includes('openai.com')) {
        return jsonResponse(401, { error: { message: `chave ${openrouterKey} recusada` } });
      }
      if (url.includes('github.ai')) return jsonResponse(502, '<html>PRIVATE GATEWAY</html>');
      return jsonResponse(200, {
        content: [{ type: 'text', text: valid }],
        stop_reason: '::set-output name=x::y',
        usage: { input_tokens: 100, output_tokens: 20 },
      });
    },
  );
  assert.ok(auditDir);
  assert.deepEqual(fs.readdirSync(auditDir).sort(), [
    'attempt-1-openrouter.response.json',
    'attempt-2-openai.response.json',
    'attempt-3-github-models.response.txt',
    'attempt-4-anthropic.response.json',
    'meta.json',
    'review.json',
  ]);
  const read = (name) => fs.readFileSync(join(auditDir, name), 'utf8');
  // A resposta que falhou fica inteira, inclusive o raciocínio do modelo.
  assert.equal(
    JSON.parse(read('attempt-1-openrouter.response.json')).choices[0].message.reasoning,
    'RACIOCÍNIO DO MODELO',
  );
  assert.match(read('attempt-2-openai.response.json'), /\[REDACTED\]/);
  assert.equal(read('attempt-3-github-models.response.txt'), '<html>PRIVATE GATEWAY</html>');
  assert.equal(read('review.json'), valid);
  for (const name of fs.readdirSync(auditDir)) {
    assert.doesNotMatch(read(name), /SECRETVALUE|allowed diff|Bearer/);
  }
  const meta = JSON.parse(read('meta.json'));
  assert.equal(meta.pr_number, '1067');
  assert.equal(meta.diff_bytes, 200000);
  assert.equal(meta.diff_bytes_sent, 150000);
  assert.equal(meta.diff_truncated, true);
  assert.equal(meta.file_count, 2);
  assert.deepEqual(meta.result, {
    status: 'ok',
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
  });
  assert.deepEqual(meta.attempts[0], {
    attempt: 1,
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-5.5',
    response_model: 'openai/gpt-5.6-terra',
    upstream_provider: 'OpenAI',
    http_status: 200,
    finish_reason: 'stop',
    prompt_tokens: 73489,
    completion_tokens: 812,
    reasoning_tokens: 640,
    ok: false,
    skipped: false,
    reason: 'resposta vazia',
    response_file: 'attempt-1-openrouter.response.json',
  });
  assert.equal(meta.attempts[2].http_status, 502);
  assert.equal(meta.attempts[3].ok, true);
  // Uma linha por tentativa, sem corpo de resposta e sem comando injetado.
  const lines = logs.split('\n').filter((line) => line.startsWith('Attempt '));
  assert.equal(lines.length, 4);
  assert.equal(
    lines[0],
    'Attempt 1/4: provider=openrouter model=anthropic/claude-sonnet-5.5 http=200 finish_reason=stop' +
      ' prompt_tokens=73489 completion_tokens=812 reasoning_tokens=640 result=failed',
  );
  assert.match(lines[3], /finish_reason=invalid .* reasoning_tokens=- result=ok$/);
  assert.doesNotMatch(logs + outputs, /RACIOCÍNIO|PRIVATE GATEWAY|SECRETVALUE|set-output/);
  assert.match(outputs, /reasoning_tokens<<EOF\n\n/);
});
it('tokens de raciocínio do vencedor vão para o rodapé; falha de rede não gera arquivo de resposta', async () => {
  let first = true;
  const { outputs, auditDir } = await runCallStep(
    {
      REVIEW_PROVIDERS: '["openai","openrouter"]',
      OPENAI_API_KEY: 'openai-test-key',
      OPENROUTER_API_KEY: 'or-test-key',
    },
    async () => {
      if (first) {
        first = false;
        throw new Error('socket hang up');
      }
      return jsonResponse(200, {
        choices: [
          {
            finish_reason: 'stop',
            message: { content: '{"summary":"ok","changes":[],"feedback":[]}' },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          completion_tokens_details: { reasoning_tokens: 3 },
        },
      });
    },
  );
  assert.match(outputs, /reasoning_tokens<<EOF\n3\n/);
  const meta = JSON.parse(fs.readFileSync(join(auditDir, 'meta.json'), 'utf8'));
  assert.equal(meta.attempts[0].reason, 'network error');
  assert.equal(meta.attempts[0].response_file, null);
  assert.deepEqual(fs.readdirSync(auditDir).sort(), [
    'attempt-2-openrouter.response.json',
    'meta.json',
    'review.json',
  ]);
});
it('sem provedor configurado o artefato ainda leva o meta com as tentativas puladas', async () => {
  const { outputs, auditDir } = await runCallStep({ REVIEW_PROVIDERS: '["openai"]' }, async () => {
    throw new Error('não deveria chamar');
  });
  assert.match(outputs, /status<<EOF\nskipped\n/);
  const meta = JSON.parse(fs.readFileSync(join(auditDir, 'meta.json'), 'utf8'));
  assert.deepEqual(meta.result, { status: 'skipped', provider: null, model: null });
  assert.equal(meta.attempts[0].skipped, true);
});
it('upload do artefato roda mesmo após falha, com SHA fixo, retenção de 30 dias e sem o diff', () => {
  const steps = review.jobs.review.steps;
  const upload = steps.find((step) => step.id === 'audit');
  assert.match(upload.uses, /^actions\/upload-artifact@[0-9a-f]{40}$/);
  assert.equal(upload.if, "always() && steps.call.outputs.audit_dir != ''");
  assert.equal(upload['continue-on-error'], true);
  assert.equal(upload.with.path, '${{ steps.call.outputs.audit_dir }}');
  assert.equal(upload.with['retention-days'], 30);
  assert.equal(upload.with['if-no-files-found'], 'ignore');
  assert.match(upload.with.name, /^automated-review-\$\{\{ inputs.pr_number \}\}-round/);
  assert.doesNotMatch(JSON.stringify(upload), /input_dir|pr\.diff/);
  // O link do rodapé depende do upload ter rodado antes do comentário.
  const names = steps.map((step) => step.name ?? step.uses);
  assert.ok(names.indexOf('Upload review audit') < names.indexOf('Post review'));
  const post = steps.find((step) => step.name === 'Post review');
  assert.equal(post.env.AUDIT_ARTIFACT_URL, '${{ steps.audit.outputs.artifact-url }}');
  assert.equal(post.env.REASONING_TOKENS, '${{ steps.call.outputs.reasoning_tokens }}');
});
async function runPostStep(env, reviewText) {
  const post = review.jobs.review.steps.find((step) => step.name === 'Post review');
  const inputDir = fs.mkdtempSync(join(work, 'post-'));
  if (reviewText !== undefined) fs.writeFileSync(join(inputDir, 'review.json'), reviewText);
  const bodies = [];
  await vm.runInNewContext(`(async () => { ${post.with.script} })()`, {
    require: (name) => (name === 'node:path' ? { join } : fs),
    process: {
      env: {
        PR_NUMBER: '12',
        HEAD_SHA: 'a'.repeat(40),
        REVIEW_ROUND: '1',
        REVIEW_INPUT_DIR: inputDir,
        PROVIDER_LABEL: 'OpenRouter',
        PROVIDER_MODEL: 'openai/gpt-5.6-terra',
        RUN_URL: 'https://github.com/example/repo/actions/runs/1',
        ...env,
      },
    },
    github: {
      rest: {
        issues: { createComment: async ({ body }) => bodies.push(body) },
        pulls: { createReviewComment: async () => {} },
      },
    },
    context: { repo: { owner: 'example', repo: 'repo' } },
    console: { log() {} },
  });
  return bodies;
}
it('rodapé do comentário traz tokens de raciocínio e o link do artefato, sem mudar o marcador', async () => {
  const valid = '{"summary":"ok","changes":[],"feedback":[]}';
  const [body] = await runPostStep(
    {
      REVIEW_STATUS: 'ok',
      PROMPT_TOKENS: '73489',
      COMPLETION_TOKENS: '812',
      REASONING_TOKENS: '640',
      AUDIT_ARTIFACT_URL: 'https://github.com/example/repo/actions/runs/1/artifacts/2',
    },
    valid,
  );
  assert.match(body, /<!-- AUTOMATED_REVIEW_ROUND_1 -->/);
  assert.match(
    body,
    /\*Reviewed by OpenRouter openai\/gpt-5\.6-terra \| 73,489 in \/ 812 out \(640 reasoning\) \| \[audit artifact\]\(https:\/\/github\.com\/example\/repo\/actions\/runs\/1\/artifacts\/2\) — Round 1 of 2\*/,
  );
  // Sem tokens de raciocínio nem URL do artefato, o link cai para o run.
  const [fallback] = await runPostStep(
    { REVIEW_STATUS: 'ok', PROMPT_TOKENS: '10', COMPLETION_TOKENS: '5' },
    valid,
  );
  assert.doesNotMatch(fallback, /reasoning/);
  assert.match(
    fallback,
    /10 in \/ 5 out \| \[run\]\(https:\/\/github\.com\/example\/repo\/actions\/runs\/1\)/,
  );
  const [failure] = await runPostStep({ REVIEW_STATUS: 'error', ERROR_REASON: 'OpenAI: HTTP 500' });
  assert.match(failure, /Review failed — OpenAI: HTTP 500/);
  assert.match(
    failure,
    /\*Audit: \[run\]\(https:\/\/github\.com\/example\/repo\/actions\/runs\/1\)\*/,
  );
  assert.doesNotMatch(failure, /AUTOMATED_REVIEW_ROUND/);
});
