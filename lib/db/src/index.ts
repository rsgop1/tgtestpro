import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let db: any;
let pool: any;

try {
  let poolConfig;
  
  if (process.env.SQL_HOST) {
    poolConfig = {
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    };
  } else {
    if (!process.env.DATABASE_URL) throw new Error("No DB");
    if (process.env.DATABASE_URL.includes("helium")) throw new Error("Local helium DB not accessible in cloud");
    poolConfig = { connectionString: process.env.DATABASE_URL };
  }
  
  pool = new pg.Pool(poolConfig);
  db = drizzle(pool, { schema });
} catch (e) {
  console.warn('[AI Studio] Database not connected — using mock');
  const noOp = { 
    findMany: async () => [], 
    findFirst: async () => null,
    findUnique: async () => null, 
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {}, 
    delete: async () => ({}) 
  };
  
  const createMockChain = (): any => {
    const callable = () => createMockChain();
    return new Proxy(callable, {
      get: (target, prop) => {
        if (prop === 'then') {
          return (resolve: any) => resolve([]);
        }
        if (prop === 'catch' || prop === 'finally') {
           return createMockChain;
        }
        return createMockChain();
      },
      apply: () => createMockChain()
    });
  };

  db = new Proxy({}, {
    get: (_, prop) => {
      if (prop === 'query') {
        return new Proxy({}, { get: () => noOp });
      }
      return createMockChain();
    }
  });
  
  pool = { 
    query: async () => ({ rows: [] }), 
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) 
  };
}

export { db, pool };
export * from "./schema";
