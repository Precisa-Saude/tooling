/**
 * Semantic Release configuration.
 *
 * Multi-package monorepo strategy: every publishable workspace package is
 * released together at the same version. A single commit on `main` triggers
 * one release cycle that updates the root version and syncs it to every
 * `packages/*` that isn't marked `private`. The actual `pnpm publish` step
 * runs in `.github/workflows/_publish.yml` (pinned to the release SHA), so
 * this config only handles version bumping, changelog, and the release
 * commit/tag.
 *
 * Version bumps follow Conventional Commits:
 *   - feat:                  minor
 *   - fix / perf / refactor: patch
 *   - BREAKING CHANGE: footer → major
 *   - docs / style / test / ci / chore / build → no release
 */

const presetConfig = {
  types: [
    { type: 'feat', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'perf', section: 'Performance' },
    { type: 'refactor', section: 'Refactoring' },
    { type: 'docs', section: 'Documentation' },
    { type: 'style', section: 'Styles' },
    { type: 'test', section: 'Tests' },
    { type: 'ci', section: 'CI/CD' },
    { type: 'chore', section: 'Chores' },
    { type: 'revert', section: 'Reverts' },
    { type: 'build', section: 'Build' },
  ],
};

const releaseRules = [
  { type: 'feat', release: 'minor' },
  { type: 'fix', release: 'patch' },
  { type: 'perf', release: 'patch' },
  { type: 'refactor', release: 'patch' },
  { type: 'docs', release: false },
  { type: 'style', release: false },
  { type: 'test', release: false },
  { type: 'ci', release: false },
  { type: 'chore', release: false },
  { type: 'revert', release: 'patch' },
  { type: 'build', release: false },
];

module.exports = {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits', releaseRules }],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits', presetConfig }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],

    // Bump root package.json version. Never publishes — the root is `private`.
    ['@semantic-release/npm', { npmPublish: false }],

    // Propagate the new version to every non-private workspace package.
    ['@semantic-release/exec', { prepareCmd: 'node scripts/sync-versions.cjs' }],

    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'packages/*/package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],

    [
      '@semantic-release/github',
      { successCommentCondition: false, releasedLabels: false, failComment: false },
    ],
  ],
};
