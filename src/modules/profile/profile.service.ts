import { prisma } from '../../config/prisma';
import { Profile } from '@prisma/client';
import { CreateProfileInput, UpdateProfileInput } from './profile.schemas';

const MAX_PHOTOS = 5;

export async function createProfile(
  userId: string,
  data: CreateProfileInput,
): Promise<Profile> {
  return prisma.profile.create({
    data: {
      userId,
      firstName: data.firstName,
      lastName: data.lastName,
      neighborhood: data.neighborhood,
      bio: data.bio,
      birthdate: new Date(data.birthdate),
      gender: data.gender,
      interests: data.interests,
      relationshipGoal: data.relationshipGoal,
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
    },
  });
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  return prisma.profile.findUnique({ where: { userId } });
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  return prisma.profile.findUnique({ where: { userId } });
}

export async function updateProfile(
  userId: string,
  data: UpdateProfileInput,
): Promise<Profile> {
  return prisma.profile.update({
    where: { userId },
    data: {
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.neighborhood !== undefined && { neighborhood: data.neighborhood }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.birthdate && { birthdate: new Date(data.birthdate) }),
      ...(data.gender && { gender: data.gender }),
      ...(data.interests && { interests: data.interests }),
      ...(data.relationshipGoal && { relationshipGoal: data.relationshipGoal }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.city !== undefined && { city: data.city }),
      lastSeenAt: new Date(),
    },
  });
}

export async function addPhoto(userId: string, photoUrl: string): Promise<Profile> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profil introuvable');
  if (profile.photos.length >= MAX_PHOTOS) {
    throw new Error(`Maximum ${MAX_PHOTOS} photos autorisées`);
  }
  return prisma.profile.update({
    where: { userId },
    data: { photos: [...profile.photos, photoUrl] },
  });
}

export async function removePhoto(userId: string, index: number): Promise<Profile> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profil introuvable');
  if (index < 0 || index >= profile.photos.length) {
    throw new Error('Index de photo invalide');
  }
  const updated = profile.photos.filter((_, i) => i !== index);
  return prisma.profile.update({
    where: { userId },
    data: { photos: updated },
  });
}

export async function updateLocation(
  userId: string,
  latitude: number,
  longitude: number,
  city?: string,
): Promise<void> {
  await prisma.profile.update({
    where: { userId },
    data: { latitude, longitude, city, lastSeenAt: new Date() },
  });
}
