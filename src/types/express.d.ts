import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        firebaseUid: string;
        email?: string | null;
      };
    }
  }
}

export {};
