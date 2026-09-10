import { createRequire } from 'node:module';

const [major, minor] = process.versions.node.split('.').map(Number);

if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\nДля запуска Due Passi нужна Node.js 22.13 или новее.`);
  console.error(`Сейчас используется Node.js ${process.versions.node}.`);
  console.error('Если установлен nvm, выполните: nvm install 22 && nvm use 22\n');
  process.exit(1);
}

try {
  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3');
  const database = new Database(':memory:');
  database.close();
} catch (error) {
  console.error('Не удалось загрузить модуль SQLite для текущей версии Node.js.');
  console.error('Выполните npm rebuild better-sqlite3 и повторите запуск.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
