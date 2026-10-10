/** A versão e o SHA são incorporados ao build da release. */
export const CLI_VERSION = process.env.PRECISA_CLI_VERSION ?? '0.0.0';
export const WORKFLOW_REF = process.env.PRECISA_WORKFLOW_REF ?? '';
export const WORKFLOW_VERSION = CLI_VERSION;
