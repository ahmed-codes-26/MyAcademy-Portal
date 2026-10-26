// Exact screenshot processing: opaque redaction before resizing; never ship originals.
// Usage: node scripts/prepare-dashboard-previews.cjs <teacher.png> <student.png> <admin.png>
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('../server/node_modules/sharp');
const specs = [
  { role: 'teacher', masks: [[1675, 12, 220, 68], [35, 685, 315, 78], [1440, 202, 100, 44], [450, 485, 420, 300], [950, 435, 900, 370]] },
  { role: 'student', masks: [[210, 175, 620, 122], [65, 170, 135, 130], [1815, 20, 70, 65], [65, 465, 855, 245], [1000, 625, 330, 90], [1760, 390, 90, 50], [100, 845, 500, 29]] },
  { role: 'admin', masks: [[55, 530, 1650, 344]] },
];
async function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length !== 3) throw new Error('Provide teacher, student, and admin screenshot paths.');
  const output = path.resolve(__dirname, '../client/public/previews');
  await fs.mkdir(output, { recursive: true });
  for (let i = 0; i < specs.length; i++) {
    const { role, masks } = specs[i];
    const metadata = await sharp(inputs[i]).metadata();
    if (metadata.width !== 1918 || metadata.height < 870 || metadata.height > 875) throw new Error(`Unexpected ${role} dimensions; review redactions before proceeding.`);
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1918" height="${metadata.height}">${masks.map(([x,y,w,h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#eef2f6"/><text x="${x+w/2}" y="${y+h/2+4}" text-anchor="middle" font-family="Arial" font-size="14" fill="#607084">Private data hidden</text>`).join('')}</svg>`);
    const safe = await sharp(inputs[i]).composite([{ input: overlay }]).png().toBuffer();
    for (const width of [640, 1280, 1920]) {
      const file = path.join(output, `${role}-${width}.webp`);
      await sharp(safe).resize({ width: Math.min(width, 1918) }).webp({ quality: 82, effort: 6 }).toFile(file);
      console.log(`${path.basename(file)}: ${(await fs.stat(file)).size} bytes`);
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
