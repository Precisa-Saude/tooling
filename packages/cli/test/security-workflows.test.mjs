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
it('falha no provedor autorizado não transmite a outro provedor nem registra o corpo do erro', async () => {
  const step = review.jobs.review.steps.find((step) => step.id === 'call');
  const script = step.run.replace(/^node << 'SCRIPT'\n/, '').replace(/\nSCRIPT\n?$/, '');
  const urls = [];
  const logs = [];
  const outputs = [];
  await vm.runInNewContext(script, {
    require: (name) =>
      name === 'node:path'
        ? { join }
        : {
            readFileSync: () => 'allowed diff',
            appendFileSync: (_path, value) => outputs.push(value),
          },
    process: {
      env: {
        REVIEW_INPUT_DIR: work,
        REVIEW_PROVIDERS: '["openai"]',
        OPENAI_API_KEY: 'test-key',
        ANTHROPIC_API_KEY: 'test-key',
        GITHUB_TOKEN: 'test-key',
        GITHUB_OUTPUT: 'outputs',
        REVIEW_ROUND: '1',
      },
    },
    console: { log: (value) => logs.push(value) },
    fetch: async (url) => {
      urls.push(url);
      return {
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: { message: 'PRIVATE RESPONSE CONTENT' } }),
      };
    },
  });
  assert.deepEqual(urls, ['https://api.openai.com/v1/chat/completions']);
  assert.doesNotMatch(logs.join('\n') + outputs.join('\n'), /PRIVATE RESPONSE CONTENT/);
});
