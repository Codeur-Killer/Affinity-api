import multer from 'multer';
import { Request } from 'express';
import { env } from '../config/env';
import { uploadToCloudinary } from '../config/cloudinary';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Stockage en mémoire (buffer) → on upload vers Cloudinary
const memoryStorage = multer.memoryStorage();

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format non supporté. Utilisez JPEG, PNG ou WebP.'));
  }
}

const multerOpts = {
  storage:   memoryStorage,
  limits:    { fileSize: env.MAX_FILE_SIZE_BYTES },
  fileFilter,
};

export const uploadPhoto = multer(multerOpts).single('photo');

export const uploadVerification = multer(multerOpts).fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack',  maxCount: 1 },
  { name: 'selfie',  maxCount: 1 },
]);

// ── Upload un fichier vers Cloudinary et retourne l'URL sécurisée ─────────────
export async function uploadFileToCloud(
  file:   Express.Multer.File,
  folder: string,
): Promise<string> {
  return uploadToCloudinary(file.buffer, folder);
}
