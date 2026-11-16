/** Prints a line of the log, /ask's or /contact's, as one line of JSON,
    for Workers Logs. Fields left undefined are left out. */
export const logToConsole = (line: object): void => console.log(JSON.stringify(line));
