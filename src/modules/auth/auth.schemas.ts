import { z } from 'zod';

export const syncSchema = z.object({
  firebaseToken: z.string().min(1, 'Token Firebase requis'),
  fcmToken: z.string().optional(),
});

export const deleteAccountSchema = z.object({
  firebaseToken: z.string().min(1, 'Token Firebase requis'),
});

export const sendOtpSchema = z.object({
  phone: z.string()
    .min(8, 'Numéro invalide')
    .max(15, 'Numéro invalide')
    .regex(/^[0-9+]+$/, 'Numéro invalide'),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(8),
  code: z.string().length(4, 'Le code doit contenir 4 chiffres').regex(/^\d{4}$/),
});

export type SyncInput = z.infer<typeof syncSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
