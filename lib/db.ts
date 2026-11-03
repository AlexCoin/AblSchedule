import { syncBundledCatalog } from "./bundled-catalog";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { seed, State } from "./domain";
let sqlite: DatabaseSync;
let pool: Pool;
let ready: Promise<unknown> | undefined;
async function connection() {
  if (process.env.DATABASE_URL) {
    pool ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      allowExitOnIdle: true,
      max: 5,
      connectionTimeoutMillis: 10000,
    });
    ready ??= pool
      .query(
        "CREATE TABLE IF NOT EXISTS app (id INTEGER PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS login (token TEXT PRIMARY KEY,user_id TEXT,expires BIGINT NOT NULL)",
      )
      .catch((error) => {
        ready = undefined;
        throw error;
      });
    await ready;
    return pool;
  }
  if (!sqlite) {
    const path = process.env.DATABASE_PATH || "data/abl.sqlite";
    mkdirSync(dirname(path), { recursive: true });
    sqlite = new DatabaseSync(path);
    sqlite.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app (id INTEGER PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS login (token TEXT PRIMARY KEY, user_id TEXT, expires BIGINT NOT NULL)",
    );
    sqlite
      .prepare("INSERT OR IGNORE INTO app VALUES (1,?)")
      .run(JSON.stringify(seed()));
  }
  return null;
}
export async function transaction<T>(fn: (s: State) => T): Promise<T> {
  const p = await connection();
  if (p) {
    const c = await p.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        "CREATE TABLE IF NOT EXISTS app (id INTEGER PRIMARY KEY,value TEXT NOT NULL)",
      );
      await c.query("INSERT INTO app VALUES (1,$1) ON CONFLICT DO NOTHING", [
        JSON.stringify(seed()),
      ]);
      const q = await c.query("SELECT value FROM app WHERE id=1 FOR UPDATE");
      const s = JSON.parse(q.rows[0].value);
      syncBundledCatalog(s);
      const result = fn(s);
      await c.query("UPDATE app SET value=$1 WHERE id=1", [JSON.stringify(s)]);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const s = JSON.parse(
      (sqlite.prepare("SELECT value FROM app WHERE id=1").get() as any).value,
    );
    syncBundledCatalog(s);
    const result = fn(s);
    sqlite.prepare("UPDATE app SET value=? WHERE id=1").run(JSON.stringify(s));
    sqlite.exec("COMMIT");
    return result;
  } catch (e) {
    sqlite.exec("ROLLBACK");
    throw e;
  }
}
export async function loginQuery(sql: string, args: any[] = []) {
  const p = await connection();
  if (p) {
    await p.query(
      "CREATE TABLE IF NOT EXISTS login (token TEXT PRIMARY KEY,user_id TEXT,expires BIGINT NOT NULL)",
    );
    let i = 0;
    return (
      await p.query(
        sql.replace(/\?/g, () => "$" + ++i),
        args,
      )
    ).rows;
  }
  const stmt = sqlite.prepare(sql);
  return sql.trim().toUpperCase().startsWith("SELECT")
    ? stmt.all(...args)
    : stmt.run(...args);
}
