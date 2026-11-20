// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// Counts and integer identifiers stay within JavaScript's safe integer range.
types.setTypeParser(20, (value) => Number(value));
let pool: Pool | undefined;
function connectionPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const noTls =
    process.env.DATABASE_TLS === "local-only" &&
    local &&
    process.env.NODE_ENV !== "production";
  // URL sslmode parameters must not override certificate verification.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  pool = new Pool({
    connectionString: url.toString(),
    max: 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: noTls
      ? false
      : {
          rejectUnauthorized: true,
          ...(process.env.DATABASE_CA_PEM
            ? { ca: process.env.DATABASE_CA_PEM.replace(/\\n/g, "\n") }
            : {}),
        },
  });
  return pool;
}
/** Positional parameters, never value interpolation. Quoted SQL text is preserved. */
function parameters(sql: string) {
  let quoted = false,
    index = 0,
    out = "";
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") {
      out += c;
      if (quoted && sql[i + 1] === "'") {
        out += sql[++i];
        continue;
      }
      quoted = !quoted;
      continue;
    }
    out += c === "?" && !quoted ? "$" + ++index : c;
  }
  return out;
}
function normalize(row: QueryResultRow) {
  for (const [key, value] of Object.entries(row))
    if (value instanceof Date)
      row[key] = ["created_at", "updated_at", "deleted_at"].includes(key)
        ? value.toISOString().slice(0, 19).replace("T", " ")
        : value.toISOString();
  return row;
}
export class Statement {
  constructor(
    readonly sql: string,
    readonly values: unknown[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.sql, values);
  }
  async execute(client?: PoolClient) {
    const result = await (client || connectionPool()).query(
      parameters(this.sql),
      this.values,
    );
    return {
      results: result.rows.map(normalize),
      meta: { changes: result.rowCount || 0, last_row_id: result.rows[0]?.id },
    };
  }
  async all<T = Record<string, unknown>>() {
    return (await this.execute()) as {
      results: T[];
      meta: { changes: number; last_row_id?: number };
    };
  }
  async first<T = Record<string, unknown>>() {
    return (await this.all<T>()).results[0] || null;
  }
  async run() {
    return this.execute();
  }
}
export function getDatabase() {
  return {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) => {
      const client = await connectionPool().connect();
      try {
        await client.query("BEGIN");
        const results = [];
        for (const statement of statements)
          results.push(await statement.execute(client));
        await client.query("COMMIT");
        return results;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

/** Graceful shutdown for command-line checks and integration tests. */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
