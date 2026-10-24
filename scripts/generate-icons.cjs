const fs = require('node:fs');
const path = require('node:path');
const sharp = require('../server/node_modules/sharp');

async function main() {
  const source = path.join(__dirname, '../client/src/assets/logo.svg');
  const output = path.join(__dirname, '../client/public');
  fs.copyFileSync(source, path.join(output, 'favicon.svg'));
  for (const [name, size] of [['favicon.png', 192], ['favicon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    await sharp(source, { density: 144 }).resize(size, size).png({ palette: true, colours: 64, effort: 10 })
      .toFile(path.join(output, name));
  }
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()));
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2); directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  images.forEach((buffer, i) => {
    const entry = 6 + i * 16;
    directory[entry] = sizes[i]; directory[entry + 1] = sizes[i];
    directory.writeUInt16LE(1, entry + 4); directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(buffer.length, entry + 8); directory.writeUInt32LE(offset, entry + 12);
    offset += buffer.length;
  });
  fs.writeFileSync(path.join(output, 'favicon.ico'), Buffer.concat([directory, ...images]));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
