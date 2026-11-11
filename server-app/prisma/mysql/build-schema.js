// Génère prisma/mysql/schema.prisma (production, MySQL) à partir de
// prisma/schema.prisma (développement, SQLite), qui reste la référence.
// Usage : npm run db:mysql:schema
//
// Différences introduites :
// - fournisseur « mysql » ;
// - sortie du client généré inchangée (src/generated/prisma) ;
// - les textes libres deviennent LONGTEXT. Sous MySQL, un String vaut
//   VARCHAR(191) par défaut, trop court pour les résumés, récits et JSON.
//   Restent en VARCHAR(191) les champs qui servent de clé : identifiants,
//   clés étrangères, champs uniques ou indexés, et ceux qui ont une valeur
//   par défaut (MySQL n'en accepte pas sur un LONGTEXT).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '..', 'schema.prisma'), 'utf8');

const LONG_WITH_DEFAULT = new Set(['searchText', 'fields', 'data', 'reviews', 'publication', 'contentRefs'])

const lines = source.split('\n');
const out = [];
let model = null;
let block = [];

function flushModel() {
  // Champs utilisés comme clés : @@index, @@unique, @@id, et relations.
  const keyFields = new Set();
  for (const line of block) {
    const compound = line.match(/@@(?:index|unique|id)\(\[([^\]]+)\]/);
    if (compound) compound[1].split(',').forEach((f) => keyFields.add(f.trim().split('(')[0]));
    const relation = line.match(/@relation\([^)]*fields:\s*\[([^\]]+)\]/);
    if (relation) relation[1].split(',').forEach((f) => keyFields.add(f.trim()));
  }
  for (const line of block) {
    const field = line.match(/^(\s+)(\w+)(\s+)String(\??)(.*)$/);
    if (!field) {
      out.push(line);
      continue;
    }
    const [, indent, name, gap, optional, rest] = field;
    // Textes longs avec valeur par défaut (JSON, texte de recherche) : LONGTEXT
    // quand même ; MySQL 8 accepte une valeur par défaut sous forme d'expression.
    const longDefault = LONG_WITH_DEFAULT.has(name) && /@default\("/.test(rest)
    const isKey = !longDefault && (keyFields.has(name) || /@id\b|@unique\b|@default\(/.test(rest) || /@db\./.test(rest));
    if (isKey) out.push(line);
    else out.push(`${indent}${name}${gap}String${optional} @db.LongText${rest}`);
  }
  block = [];
}

for (const line of lines) {
  if (model) {
    block.push(line);
    if (/^}/.test(line)) {
      flushModel();
      model = null;
    }
    continue;
  }
  if (/^model\s+\w+\s*{/.test(line)) {
    model = line;
    out.push(line);
    continue;
  }
  out.push(line);
}

let schema = out.join('\n');
schema = schema.replace(/provider = "sqlite"/, 'provider = "mysql"');
schema = schema.replace('output                 = "../src/generated/prisma"', 'output                 = "../../src/generated/prisma"');
schema = `// FICHIER GÉNÉRÉ par prisma/mysql/build-schema.js : ne pas modifier à la main.\n// Modifier prisma/schema.prisma puis lancer « npm run db:mysql:schema ».\n\n${schema}`;
writeFileSync(path.join(here, 'schema.prisma'), schema);
console.log('prisma/mysql/schema.prisma généré')
console.log('Nouvelle migration MySQL : voir docs/DEPLOIEMENT.md.');
