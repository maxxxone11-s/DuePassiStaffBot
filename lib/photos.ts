import sharp from 'sharp';
import { statfs } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { AppDatabase } from './db';

const maxInput = 15 * 1024 * 1024;
const maxStorage = 64 * 1024 * 1024;
let processing = false;
export const photoPattern = /^\/api\/app\?photo=([0-9a-f-]{36})&size=960$/;

export async function uploadPhoto(request: NextRequest, db: AppDatabase) {
  if (processing) return NextResponse.json({ error: 'Другое фото ещё обрабатывается. Попробуйте через несколько секунд' }, { status: 429 });
  processing = true;
  try {
    if (Number(request.headers.get('content-length')) > maxInput) return NextResponse.json({ error: 'Фото должно быть не больше 15 МБ' }, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Выберите фото' }, { status: 400 });
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxInput) { await reader.cancel(); return NextResponse.json({ error: 'Фото должно быть не больше 15 МБ' }, { status: 413 }); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    let large: Buffer; let small: Buffer;
    try {
      const source = sharp(bytes, { limitInputPixels: 50_000_000, animated: false });
      const metadata = await source.metadata();
      if (!['jpeg', 'png', 'webp', 'heif'].includes(metadata.format || '') || (metadata.pages || 1) > 1) throw new Error('Unsupported image');
      large = await source.rotate().resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      small = await sharp(large).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    } catch { return NextResponse.json({ error: 'Не удалось прочитать фото. Выберите JPEG, PNG или WebP. Если это HEIC, экспортируйте его в JPEG' }, { status: 400 }); }
    const disk = await statfs(dirname(resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || '.data/duepassi.sqlite')));
    if (disk.bavail * disk.bsize < 128 * 1024 * 1024) return NextResponse.json({ error: 'На сервере мало места. Обратитесь к ответственному за приложение' }, { status: 507 });
    // Abandoned previews and replaced images remain available for a day before cleanup.
    await db.prepare("DELETE FROM dish_photos WHERE created_at < ? AND NOT EXISTS (SELECT 1 FROM dishes WHERE photo = '/api/app?photo=' || dish_photos.id || '&size=960')").bind(new Date(Date.now() - 86400000).toISOString()).run();
    const used = await db.prepare('SELECT COALESCE(SUM(length(full) + length(thumb)), 0) AS bytes FROM dish_photos').first<{ bytes: number }>();
    if ((used?.bytes || 0) + large.length + small.length > maxStorage) return NextResponse.json({ error: 'Хранилище фото заполнено. Обратитесь к ответственному за приложение' }, { status: 507 });
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO dish_photos (id, full, thumb, created_at) VALUES (?, ?, ?, ?)').bind(id, large, small, new Date().toISOString()).run();
    return NextResponse.json({ photo: `/api/app?photo=${id}&size=960` });
  } finally { processing = false; }
}

export async function readPhoto(request: NextRequest, db: AppDatabase) {
  const id = request.nextUrl.searchParams.get('photo') || '';
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });
  const column = request.nextUrl.searchParams.get('size') === '480' ? 'thumb' : 'full';
  const row = await db.prepare(`SELECT ${column} AS image FROM dish_photos WHERE id = ?`).bind(id).first<{ image: Buffer }>();
  if (!row) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(row.image), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}
