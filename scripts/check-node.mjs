const [major, minor] = process.versions.node.split('.').map(Number);

if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\nДля запуска Due Passi нужна Node.js 22.13 или новее.`);
  console.error(`Сейчас используется Node.js ${process.versions.node}.`);
  console.error('Если установлен nvm, выполните: nvm install 22 && nvm use 22\n');
  process.exit(1);
}
