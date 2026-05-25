/** Published npm binary name (`package.json` → `bin.codefence`). */
export const CLI_NAME = "codefence";

/** User-facing command line, e.g. `codefence scan --staged`. */
export function cliInvocation(subcommand: string, args = ""): string {
  return args ? `${CLI_NAME} ${subcommand} ${args}` : `${CLI_NAME} ${subcommand}`;
}
