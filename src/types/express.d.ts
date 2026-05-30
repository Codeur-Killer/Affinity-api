import { User } from '@prisma/client';
import { Multer } from 'multer';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        firebaseUid: string;
        email?: string | null;
      };
      file?: Multer.File;
      files?: Multer.File[];
    }
  }
}

export {};