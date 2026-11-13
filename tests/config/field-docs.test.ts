/* The config's types are its manual: an editor shows a field's doc comment
   as a site owner writes the field. This reads the types themselves, from
   SiteConfig down, so it holds on any site. */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { PAGE_STRING_NAMES, SCRIPT_STRING_NAMES } from "../../src/config/strings.ts";
import { ROOT } from "../../src/site/repo.ts";

const CONFIG_TYPES_FILE = join(ROOT, "src/config/site-config.ts");
const WHOLE_CONFIG_TYPE = "SiteConfig";

/** The most lines a field's doc runs to: past that it's a guide, and belongs in docs/. */
const LONGEST_DOC_IN_LINES = 6;

/** A field a site owner can write, as the checks below name it. */
type Field = {
  /** Where it is, from the whole config: "languages.<code>.home.greeting.morning". */
  path: string;
  /** Its doc comment's text, "" without one. */
  doc: string;
};

function compilerOptions(): ts.CompilerOptions {
  const { config } = ts.readConfigFile(join(ROOT, "tsconfig.json"), ts.sys.readFile);
  return ts.parseJsonConfigFileContent(config, ts.sys, ROOT).options;
}

/** Every field reachable from the whole config's type, each once. */
function fieldsOfTheConfig(): Field[] {
  const program = ts.createProgram([CONFIG_TYPES_FILE], compilerOptions());
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(CONFIG_TYPES_FILE)!);
  const wholeConfig = checker.getExportsOfModule(moduleSymbol!).find((symbol) => symbol.name === WHOLE_CONFIG_TYPE);
  assert.ok(wholeConfig, `${CONFIG_TYPES_FILE} exports ${WHOLE_CONFIG_TYPE}`);

  const fields: Field[] = [];
  const typesRead = new Set<ts.Type>();

  /** Nothing a site owner can write: `tab?: never` on a topic that opens no tab. */
  const isNeverWritten = (type: ts.Type): boolean =>
    Boolean(type.flags & (ts.TypeFlags.Never | ts.TypeFlags.Undefined | ts.TypeFlags.Void));

  const isList = (type: ts.Type): boolean => checker.isArrayType(type) || checker.isTupleType(type);

  const hasFields = (type: ts.Type): boolean =>
    (Boolean(type.flags & ts.TypeFlags.Object) || type.isIntersection()) && !isList(type);

  /** What a type holds besides fields of its own, each with where it is: a
      union's kinds, a list's items, the values under any key of a record. */
  function heldBy(type: ts.Type, path: string): Array<[held: ts.Type, heldPath: string]> {
    if (type.isUnion()) return type.types.map((kind) => [kind, path]);
    if (isList(type)) return checker.getTypeArguments(type as ts.TypeReference).map((item) => [item, `${path}[]`]);
    const valueOfAnyKey = hasFields(type) ? checker.getIndexTypeOfType(type, ts.IndexKind.String) : undefined;
    return valueOfAnyKey ? [[valueOfAnyKey, `${path}.<key>`]] : [];
  }

  function readFields(type: ts.Type, path: string): void {
    for (const property of checker.getPropertiesOfType(type)) {
      const propertyType = checker.getTypeOfSymbol(property);
      if (isNeverWritten(propertyType)) continue;
      const fieldPath = path ? `${path}.${property.name}` : property.name;
      fields.push({ path: fieldPath, doc: ts.displayPartsToString(property.getDocumentationComment(checker)).trim() });
      read(propertyType, fieldPath);
    }
  }

  function read(type: ts.Type, path: string): void {
    if (typesRead.has(type)) return;
    typesRead.add(type);
    for (const [held, heldPath] of heldBy(type, path)) read(held, heldPath);
    if (hasFields(type)) readFields(type, path);
  }

  read(checker.getDeclaredTypeOfSymbol(wholeConfig), "");
  return fields;
}

/** The fields, one for each path: a field every kind of a union has (a
    topic's `label`) is read once for each kind. */
const oncePerPath = (all: Field[]): Field[] => [...new Map(all.map((field) => [field.path, field])).values()];

const fields = oncePerPath(fieldsOfTheConfig());

/** Where each language's wording is, from the whole config. */
const STRINGS = "languages.<key>.strings.";

test("the config's types are read: the walk finds the fields a config has", () => {
  const paths = fields.map((field) => field.path);
  assert.ok(paths.includes("languages.<key>.threads[].messages[].read.card.lines[][].accent"), paths.join("\n"));
});

test("every field a site owner can write has a doc comment, which an editor shows on hover", () => {
  const bare = fields.filter((field) => field.doc === "").map((field) => field.path);
  assert.deepEqual(bare, [], `these fields of ${WHOLE_CONFIG_TYPE} have no /** doc */ over them`);
});

test("no field's doc is a guide: what takes more than a few lines to say is in docs/", () => {
  const long = fields
    .filter((field) => field.doc.split("\n").length > LONGEST_DOC_IN_LINES)
    .map((field) => `${field.path} (${field.doc.split("\n").length} lines)`);
  assert.deepEqual(long, [], `these docs run past ${LONGEST_DOC_IN_LINES} lines`);
});

test("the lists of the strings' names have every string the type has, and no other", () => {
  const namesInTheType = fields
    .filter((field) => field.path.startsWith(STRINGS))
    .map((field) => field.path.slice(STRINGS.length));
  assert.deepEqual(namesInTheType.toSorted(), [...PAGE_STRING_NAMES, ...SCRIPT_STRING_NAMES].toSorted());
});
