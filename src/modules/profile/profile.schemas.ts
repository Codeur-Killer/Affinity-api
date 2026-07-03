import { z } from 'zod';

export const createProfileSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().max(50).optional(),
  neighborhood: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  birthdate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  interests: z.array(z.string()).min(1).max(14),
  relationshipGoal: z.enum(['FLIRT', 'LOVE']),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  city: z.string().max(100).optional(),
});

export const updateProfileSchema = createProfileSchema.partial().extend({
  incognito: z.boolean().optional(),
});

export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  city: z.string().max(100).optional(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
