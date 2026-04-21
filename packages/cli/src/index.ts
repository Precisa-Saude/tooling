export { runDoctor } from './commands/doctor.js';
export { runNew } from './commands/new.js';
export { runSync } from './commands/sync.js';
export type { MergeStrategy, TemplateEntry } from './lib/templates.js';
export type { ManifestValidationError, PrecisaManifest, RequiredWhen } from './manifest.js';
export {
  DEFAULT_MANIFEST_FIELDS,
  isRequired,
  loadManifest,
  MANIFEST_FILENAME,
  tokenContext,
  validateManifest,
  writeManifest,
} from './manifest.js';
