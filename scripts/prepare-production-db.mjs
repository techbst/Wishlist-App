import { readFile, mkdir, writeFile } from "node:fs/promises";

// Keep one set of models while SQLite and PostgreSQL have separate migrations.
const source = new URL("../prisma/schema.prisma", import.meta.url);
const target = new URL("../prisma/postgresql/schema.prisma", import.meta.url);
const schema = await readFile(source, "utf8");
const datasource = /datasource db\s*\{[^}]*\}/;
if (!datasource.test(schema)) {
  throw new Error("Cannot find the development database datasource.");
}
await mkdir(new URL("../prisma/postgresql/", import.meta.url), { recursive: true });
await writeFile(target, schema.replace(datasource, `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`));
