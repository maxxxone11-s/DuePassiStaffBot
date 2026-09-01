import { readFile, writeFile } from 'node:fs/promises';

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error('Usage: node scripts/build-book-pages.mjs <input.txt> <output.json>');
}

const source = await readFile(inputPath, 'utf8');
const sourcePages = source
  .replaceAll('\r\n', '\n')
  .split('\f')
  .map((page) => page.split('\n').map((line) => line.trimEnd()).join('\n').trim())
  .filter(Boolean);

if (sourcePages.length !== 60) {
  throw new Error(`Expected 60 source pages, received ${sourcePages.length}`);
}

// Pages 3–9 contain the print table of contents. The original PDF remains
// untouched; only the native mobile reader omits these pages.
const pages = sourcePages.filter((_, index) => index < 2 || index > 8);

if (pages.length !== 53) {
  throw new Error(`Expected 53 reader pages, received ${pages.length}`);
}

await writeFile(outputPath, `${JSON.stringify({ title: 'Книга гостеприимства', edition: 'Сводная редакция · август 2026', pages }, null, 2)}\n`);
