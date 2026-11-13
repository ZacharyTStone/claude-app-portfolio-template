/* What the type checker says of the config's file. The config's shape has
   one home, its types (src/config), and this asks the one tool that reads
   them where a build starts: a host runs `npm run build`, which never ran
   `npm run typecheck`. */

import { isAbsolute, relative, resolve } from "node:path";
import ts from "typescript";

/** A file as a problem names it: from the repo's root when it's in the
    repo ("site.config.ts"), and in full when it isn't. */
function nameOf(file: string, root: string): string {
  const fromRoot = relative(root, file);
  return fromRoot.startsWith("..") || isAbsolute(fromRoot) ? file : fromRoot;
}

/** "site.config.ts:67:3 Object literal may only specify known properties…":
    where the editor's cursor would go, then the compiler's own words. */
function problemOf(diagnostic: ts.Diagnostic, root: string): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n  ");
  if (!diagnostic.file) return message;
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
  return `${nameOf(diagnostic.file.fileName, root)}:${line + 1}:${character + 1} ${message}`;
}

/** The repo's own compiler options (tsconfig.json), so the build reads the
    config exactly as `npm run typecheck` and an editor do. */
function compilerOptions(root: string): ts.CompilerOptions {
  const tsconfig = ts.findConfigFile(root, ts.sys.fileExists);
  if (!tsconfig) return {};
  const parsed = ts.getParsedCommandLineOfConfigFile(
    tsconfig,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  );
  return parsed?.options ?? {};
}

export type TypeCheck = {
  /** The type errors, a problem each, or none. */
  problems: string[];
  /** The config's file and the files of the repo it imports: what the
      config is made of. */
  sources: string[];
};

/** Type-checks the config at `configPath` with what it imports. `root` is
    the repo. */
export function typeCheck(configPath: string, root: string): TypeCheck {
  const program = ts.createProgram([configPath], { ...compilerOptions(root), noEmit: true });
  const ownSources = program
    .getSourceFiles()
    .filter((file) => !file.isDeclarationFile && !program.isSourceFileFromExternalLibrary(file));
  return {
    problems: ts.getPreEmitDiagnostics(program).map((diagnostic) => problemOf(diagnostic, root)),
    sources: ownSources.map((file) => resolve(file.fileName)),
  };
}
