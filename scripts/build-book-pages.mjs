import { readFile, writeFile } from 'node:fs/promises';

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error('Usage: node scripts/build-book-pages.mjs <input.txt> <output.json>');
}

const source = await readFile(inputPath, 'utf8');
const pages = source
  .replaceAll('\r\n', '\n')
  .split('\f')
  .map((page) => page.split('\n').map((line) => line.trimEnd()).join('\n').trim())
  .filter(Boolean);

if (pages.length !== 60) {
  throw new Error(`Expected 60 pages, received ${pages.length}`);
}

await writeFile(outputPath, `${JSON.stringify({ title: 'Книга гостеприимства', edition: 'Сводная редакция · август 2026', pages }, null, 2)}\n`);
