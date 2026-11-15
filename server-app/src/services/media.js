import { execFile } from 'node:child_process';
import { open, stat, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { badRequest } from '../lib/errors.js';
import { recordAudit } from './audit.js';
import { resolveKey, storeOriginal, tempDir } from './storage.js';

// Formats acceptés au téléversement (§51, §68). SVG et HTML sont exclus
// (risque d'exécution de scripts). Le type déclaré par le navigateur n'est
// pas cru : la signature du fichier est vérifiée.
const FORMATS = {
  'image/jpeg': { kind: 'PHOTO', ext: ['jpg', 'jpeg'], test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { kind: 'PHOTO', ext: ['png'], test: (b) => b.subarray(0, 4).toString('hex') === '89504e47' },
  'image/webp': { kind: 'PHOTO', ext: ['webp'], test: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
  'image/tiff': {
    kind: 'PHOTO',
    ext: ['tif', 'tiff'],
    test: (b) => ['49492a00', '4d4d002a'].includes(b.subarray(0, 4).toString('hex')),
  },
  'audio/wav': { kind: 'AUDIO', ext: ['wav'], test: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE' },
  'audio/mpeg': {
    kind: 'AUDIO',
    ext: ['mp3'],
    test: (b) => ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  },
  'audio/mp4': { kind: 'AUDIO', ext: ['m4a'], test: (b) => ascii(b, 4, 8) === 'ftyp' },
  'video/mp4': { kind: 'VIDEO', ext: ['mp4', 'm4v'], test: (b) => ascii(b, 4, 8) === 'ftyp' },
  // Vidéos de téléphone (iPhone) : conservées telles quelles, converties en
  // H.264 pour la consultation.
  'video/quicktime': { kind: 'VIDEO', ext: ['mov'], test: (b) => ['ftyp', 'moov', 'wide', 'mdat', 'free'].includes(ascii(b, 4, 8)) },
  'application/pdf': { kind: 'DOCUMENT', ext: ['pdf'], test: (b) => ascii(b, 0, 5) === '%PDF-' },
  'text/plain': { kind: 'DOCUMENT', ext: ['txt'], test: (b) => !b.includes(0) },
};

export const ACCEPTED_MIME_TYPES = Object.keys(FORMATS);

// Types que les navigateurs déclarent pour ces mêmes formats (un M4A envoyé
// depuis un Mac arrive en audio/x-m4a, un WAV en audio/x-wav…).
const TYPE_ALIASES = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/tif': 'image/tiff',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/mp3': 'audio/mpeg',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'video/x-m4v': 'video/mp4',
};
const canonicalType = (type) => TYPE_ALIASES[type] ?? type;

// Certains navigateurs n'annoncent aucun type (ou un type générique) : le type
// se déduit alors de l'extension, puis la signature du fichier est vérifiée.
const GENERIC_TYPES = new Set(['', 'application/octet-stream']);
const typeFromExtension = (name) => {
  const extension = name?.split('.').pop()?.toLowerCase();
  return Object.entries(FORMATS).find(([, f]) => f.ext.includes(extension))?.[0] ?? null;
};
const resolveType = (declaredType, name) => (GENERIC_TYPES.has(declaredType ?? '') ? typeFromExtension(name) : canonicalType(declaredType));
export const isAcceptedType = (type, name) => Boolean(FORMATS[resolveType(type, name)]);

// Codecs vidéo d'un MP4, lus dans les descriptions d'échantillons (moov → trak
// → mdia → minf → stbl → stsd), sans lire le reste du fichier.
const MP4_CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
const H264 = new Set(['avc1', 'avc3']);
const OTHER_VIDEO = new Set(['hvc1', 'hev1', 'dvh1', 'dvhe', 'av01', 'vp08', 'vp09', 'mp4v', 's263']);

async function mp4SampleEntries(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    const read = async (position, length) => {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, position);
      return buffer.subarray(0, bytesRead);
    };
    const entries = new Set();
    const walk = async (start, end, depth) => {
      for (let pos = start; pos + 8 <= end && depth < 8; ) {
        const head = await read(pos, 16);
        if (head.length < 8) return;
        let boxSize = head.readUInt32BE(0);
        let headerSize = 8;
        const type = head.toString('latin1', 4, 8);
        if (boxSize === 1) {
          if (head.length < 16) return;
          boxSize = Number(head.readBigUInt64BE(8));
          headerSize = 16;
        } else if (boxSize === 0) {
          boxSize = end - pos;
        }
        if (boxSize < headerSize) return;
        if (MP4_CONTAINERS.has(type)) {
          await walk(pos + headerSize, Math.min(pos + boxSize, end), depth + 1);
        } else if (type === 'stsd') {
          const body = await read(pos + headerSize, Math.min(boxSize - headerSize, 4096));
          const count = body.length >= 8 ? body.readUInt32BE(4) : 0;
          for (let i = 0, p = 8; i < count && p + 8 <= body.length; i++) {
            const entrySize = body.readUInt32BE(p);
            entries.add(body.toString('latin1', p + 4, p + 8));
            if (entrySize < 8) break;
            p += entrySize;
          }
        }
        pos += boxSize;
      }
    };
    await walk(0, size, 0);
    return entries;
  } finally {
    await handle.close();
  }
}

// Seule la vidéo H.264 est lue par tous les navigateurs. Une autre vidéo
// (HEVC des téléphones récents, MPEG-4…) est acceptée si ffmpeg est
// disponible : l'original est conservé tel quel et une version H.264 est
// produite pour la consultation.
async function isH264(filePath) {
  const entries = await mp4SampleEntries(filePath);
  return [...entries].some((e) => H264.has(e)) && ![...entries].some((e) => OTHER_VIDEO.has(e));
}

let ffmpegChecked = null;
export function ffmpegAvailable() {
  ffmpegChecked ??= promisify(execFile)(config.ffmpegPath, ['-version'])
    .then(() => true)
    .catch(() => false);
  return ffmpegChecked;
}

function ascii(buffer, start, end) {
  return buffer.subarray(start, end).toString('latin1');
}

async function readHeader(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, 4096, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function identifyUpload(filePath, originalName, declaredType) {
  const extension = originalName.split('.').pop()?.toLowerCase();
  const type = resolveType(declaredType, originalName);
  const format = FORMATS[type];
  if (!format || !format.ext.includes(extension)) {
    throw badRequest('Format de fichier non accepté');
  }
  const header = await readHeader(filePath);
  if (!format.test(header)) throw badRequest('Le contenu du fichier ne correspond pas à son format déclaré');
  let needsConversion = false;
  if (format.kind === 'VIDEO' && (type !== 'video/mp4' || !(await isH264(filePath)))) {
    if (!(await ffmpegAvailable())) {
      throw badRequest(
        'La vidéo doit être un MP4 encodé en H.264. Les vidéos HEVC (réglage « Haute efficacité » des iPhone, de nombreux Android) ou MOV doivent être converties avant l’envoi.',
      );
    }
    needsConversion = true;
  }
  return { mimeType: type, kind: format.kind, needsConversion };
}

// Image de couverture d'une vidéo : une image extraite vers la première
// seconde (la toute première est souvent noire), en WebP 960 px. Elle sert de
// vignette sur les cartes des fiches, la médiathèque et avant la lecture.
export async function createVideoPoster(mediaId) {
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId }, include: { originalFile: true } });
  if (!media?.originalFile || media.kind !== 'VIDEO' || media.thumbnailFileId) return;
  const original = media.originalFile;
  const frame = path.join(tempDir(), `${randomUUID()}.jpg`);
  try {
    const grab = (at) =>
      promisify(execFile)(config.ffmpegPath, ['-nostdin', '-loglevel', 'error', '-y', '-ss', at, '-i', resolveKey(original.storageKey), '-frames:v', '1', '-q:v', '3', frame], {
        timeout: 2 * 60 * 1000,
      });
    const hasFrame = () => stat(frame).then((st) => st.size > 0).catch(() => false);
    await grab('1').catch(() => {});
    // Vidéo trop courte : aucune image à 1 s, on prend la première.
    if (!(await hasFrame())) await grab('0');
    const buffer = await sharp(frame).resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const poster = await storeOriginal({
      buffer,
      originalName: `${original.originalName.replace(/\.[^.]+$/, '')}-couverture.webp`,
      mimeType: 'image/webp',
      uploadedById: original.uploadedById,
      derivedFromId: original.id,
      transformation: 'Image extraite de la vidéo (ffmpeg, vers 1 s), WebP 960 px max, qualité 80',
    });
    await prisma.mediaAsset.update({ where: { id: mediaId }, data: { thumbnailFileId: poster.id } });
  } catch (err) {
    console.error(`Couverture de la vidéo ${mediaId} impossible :`, err.message);
  } finally {
    await unlink(frame).catch(() => {});
  }
}

// Traitements d'une vidéo après téléversement (en arrière-plan, l'un après
// l'autre) : version de consultation si nécessaire, puis couverture.
export async function processVideo(mediaId, needsConversion) {
  if (!(await ffmpegAvailable())) return;
  if (needsConversion) await createVideoDerivative(mediaId);
  await createVideoPoster(mediaId);
}

// Couvertures des vidéos déjà en ligne (au démarrage du serveur).
export async function backfillVideoPosters() {
  if (!(await ffmpegAvailable())) return;
  const videos = await prisma.mediaAsset.findMany({ where: { kind: 'VIDEO', thumbnailFileId: null }, select: { id: true } });
  for (const v of videos) await createVideoPoster(v.id);
  if (videos.length) console.log(`Couvertures vidéo générées : ${videos.length}`);
}

// Version de consultation d'une vidéo : H.264 + AAC, démarrage rapide
// (« faststart »), dimensions paires. L'original reste intact.
export async function createVideoDerivative(mediaId) {
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId }, include: { originalFile: true } });
  if (!media?.originalFile) return;
  const original = media.originalFile;
  const out = path.join(tempDir(), `${randomUUID()}.mp4`);
  try {
    await promisify(execFile)(
      config.ffmpegPath,
      ['-nostdin', '-loglevel', 'error', '-y', '-i', resolveKey(original.storageKey), '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out],
      { timeout: 2 * 60 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 },
    );
    const webFile = await storeOriginal({
      tempPath: out,
      originalName: `${original.originalName.replace(/\.[^.]+$/, '')}-web.mp4`,
      mimeType: 'video/mp4',
      uploadedById: original.uploadedById,
      derivedFromId: original.id,
      transformation: 'Conversion H.264 / AAC pour la lecture dans tous les navigateurs (ffmpeg, CRF 23)',
    });
    await prisma.mediaAsset.update({ where: { id: mediaId }, data: { webFileId: webFile.id } });
  } catch (err) {
    console.error(`Conversion de la vidéo ${mediaId} impossible :`, err.message);
  } finally {
    await unlink(out).catch(() => {});
  }
}

// Versions de consultation pour les images (§66) : l'original reste intact,
// les dérivés sont de nouveaux fichiers reliés à lui (§53).
async function createImageDerivatives(original, uploadedById, tx) {
  const source = resolveKey(original.storageKey);
  const [web, thumb] = await Promise.all([
    sharp(source).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    sharp(source).rotate().resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toBuffer(),
  ]);
  const base = original.originalName.replace(/\.[^.]+$/, '');
  const webFile = await storeOriginal({
    buffer: web,
    originalName: `${base}-web.webp`,
    mimeType: 'image/webp',
    uploadedById,
    derivedFromId: original.id,
    transformation: 'Redimensionnement 1600 px max, WebP qualité 82',
    db: tx,
  });
  const thumbnailFile = await storeOriginal({
    buffer: thumb,
    originalName: `${base}-miniature.webp`,
    mimeType: 'image/webp',
    uploadedById,
    derivedFromId: original.id,
    transformation: 'Miniature 400 px max, WebP qualité 75',
    db: tx,
  });
  return { webFileId: webFile.id, thumbnailFileId: thumbnailFile.id };
}

// Analyse antivirus facultative (§68) : activée si CLAMSCAN_PATH est défini.
// clamscan renvoie le code 1 lorsqu'un fichier est infecté.
export async function scanForMalware(filePath) {
  if (!config.clamscanPath) return;
  try {
    await promisify(execFile)(config.clamscanPath, ['--no-summary', filePath]);
  } catch (err) {
    if (err.code === 1) throw badRequest('Le fichier a été rejeté par l’analyse antivirus');
    throw err;
  }
}

export async function createMediaFromUpload({ file, metadata, user, ip }) {
  try {
    const { mimeType, kind, needsConversion } = await identifyUpload(file.path, file.originalname, file.mimetype);
    await scanForMalware(file.path);
    return await prisma.$transaction(
      async (tx) => {
        const original = await storeOriginal({
          tempPath: file.path,
          originalName: file.originalname,
          mimeType,
          uploadedById: user.id,
          db: tx,
        });
        let derivatives = {};
        if (kind === 'PHOTO') {
          derivatives = await createImageDerivatives(original, user.id, tx).catch((err) => {
            console.warn('Dérivés image non générés :', err.message);
            return {};
          });
        }
        const media = await tx.mediaAsset.create({
          data: { ...metadata, kind, originalFileId: original.id, ...derivatives, createdById: user.id },
        });
        await recordAudit(
          {
            actorId: user.id,
            action: 'MEDIA_UPLOADED',
            entityType: 'MediaAsset',
            entityId: media.id,
            details: { sha256: original.sha256, sizeBytes: original.sizeBytes, mimeType },
            ip,
          },
          tx,
        );
        return media;
      },
      { timeout: 120_000 },
    ).then((media) => {
      // Conversion en arrière-plan : le téléversement n'attend pas.
      if (kind === 'VIDEO' && !config.isTest) processVideo(media.id, needsConversion);
      return media;
    });
  } finally {
    await unlink(file.path).catch(() => {});
  }
}
