import multer from 'multer';
import { Request } from 'express';
import { env } from '../config/env';
import { uploadToCloudinary } from '../config/cloudinary';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

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

// Tout passe par la mémoire → upload direct vers Cloudinary
const memStorage = multer.memoryStorage();

const multerOpts = {
  storage:   memStorage,
  limits:    { fileSize: env.MAX_FILE_SIZE_BYTES },
  fileFilter,
};

export const uploadPhoto        = multer(multerOpts).single('photo');
export const uploadVerification = multer(multerOpts).fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack',  maxCount: 1 },
  { name: 'selfie',  maxCount: 1 },
]);

/** Upload vers Cloudinary et retourne l'URL sécurisée */
export async function uploadFileToCloud(
  file:   Express.Multer.File,
  folder: string,
): Promise<string> {
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('Fichier vide ou invalide');
  }
  return uploadToCloudinary(file.buffer, folder);
}
