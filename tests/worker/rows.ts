import { describe, it } from "node:test";

/** A table as tests: one for each row, under what the table says. A row
    that fails is named, and the rows after it still run. */
export function eachRow<Row>(
  says: string,
  rows: readonly Row[],
  nameOf: (row: Row) => string,
  check: (row: Row) => void | Promise<void>,
): void {
  describe(says, () => {
    for (const row of rows) it(nameOf(row), () => check(row));
  });
}
