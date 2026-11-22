import { Database, type Statement } from "bun:sqlite";
import { parentPort, workerData } from "node:worker_threads";
import { ALTER_TABLES, INDEX_TABLES, TABLES } from "./tables.js";

export type DatabaseQueryMode = "get" | "all" | "run";

export type DatabaseOperation = {
  sql: string;
  params?: readonly unknown[];
  mode: DatabaseQueryMode;
};

if (!parentPort) {
  throw new Error("Database worker requires a parent port");
}

type Request =
  | ({ id: number; type: "query" } & DatabaseOperation)
  | {
      id: number;
      type: "transaction";
      operations: readonly DatabaseOperation[];
    };

const database = new Database(workerData.path as string);
const statements = new Map<string, Statement>();

database.run(`PRAGMA synchronous = ${workerData.pragma.SYNCHRONOUS}`);
database.run(`PRAGMA journal_mode = ${workerData.pragma.JOURNAL_MODE}`);
database.run(
  `PRAGMA journal_size_limit = ${workerData.pragma.JOURNAL_SIZE_LIMIT}`,
);
database.run("PRAGMA foreign_keys = ON");

const initialize = database.transaction(() => {
  for (const statement of Object.values(TABLES))
    database.query(statement).run();
  for (const statement of ALTER_TABLES) {
    const [, table, column] =
      statement.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/i) ?? [];
    if (!table || !column) continue;
    const columns = database.query(`PRAGMA table_info(${table})`).all() as {
      name: string;
    }[];
    if (columns.some((entry) => entry.name === column)) continue;
    try {
      database.query(statement).run();
    } catch (error) {
      // do do do do nothing
    }
  }
  for (const statement of Object.values(INDEX_TABLES))
    database.query(statement).run();
});
initialize();
parentPort.postMessage({ ready: true });

function getStatement(sql: string): Statement {
  let statement = statements.get(sql);
  if (!statement) {
    statement = database.query(sql);
    statements.set(sql, statement);
  }
  return statement;
}

function execute(operation: DatabaseOperation): unknown {
  const statement = getStatement(operation.sql);
  const params = operation.params ?? [];

  if (operation.mode === "get") {
    const row = statement.get(...params);
    return row === null ? undefined : row;
  }
  if (operation.mode === "all") return statement.all(...params);
  return statement.run(...params);
}

function handle(request: Request): unknown {
  if (request.type === "query") return execute(request);

  const transaction = database.transaction(() =>
    request.operations.map((operation) => execute(operation)),
  );
  return transaction();
}

parentPort.on("message", (request: Request) => {
  try {
    parentPort!.postMessage({ id: request.id, result: handle(request) });
  } catch (error) {
    parentPort!.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
