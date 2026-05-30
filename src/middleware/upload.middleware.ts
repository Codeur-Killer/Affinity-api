import multer, { StorageEngine, FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { env } from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function createStorage(subDir: string): StorageEngine {
  const dest = path.join(env.UPLOAD_DIR, subDir);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

function fileFilter(_req: Request, file: any, cb: FileFilterCallback): void {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non supporté. Utilisez JPEG, PNG ou WebP.'));
  }
}

export const uploadPhoto = multer({
  storage: createStorage('photos'),
  limits: { fileSize: env.MAX_FILE_SIZE_BYTES },
  fileFilter,
}).single('photo');

export const uploadVerification = multer({
  storage: createStorage('verification'),
  limits: { fileSize: env.MAX_FILE_SIZE_BYTES },
  fileFilter,
}).fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]);

/**
 * Upload un fichier vers Firebase Storage
 * @param file - Le fichier multer à uploader
 * @param folder - Le dossier destination dans Firebase Storage
 * @returns L'URL publique du fichier uploadé
 */
export async function uploadFileToCloud(file: any, folder: string): Promise<string> {
  try {
    if (!file || !file.path) {
      throw new Error('Fichier invalide ou chemin manquant');
    }

    // Lecture du fichier depuis le disque local
    const fileBuffer = fs.readFileSync(file.path);
    const fileName = `${folder}/${uuidv4()}${path.extname(file.originalname)}`;

    // Référence au bucket Firebase Storage
    const bucket = admin.storage().bucket();
    const fileRef = bucket.file(fileName);

    // Upload du fichier
    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    // Génération de l'URL publique
    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    // Suppression du fichier temporaire local
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return url;
  } catch (error) {
    // Nettoyage en cas d'erreur
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw error;
  }
}

export function getFileUrl(req: Request, filePath: string): string {
  const filename = path.basename(filePath);
  const subDir = filePath.includes('verification') ? 'verification' : 'photos';
  return `${env.API_URL}/uploads/${subDir}/${filename}`;
}