import { Request, Response } from 'express';
import {
  createProfile,
  getMyProfile,
  getProfileById,
  updateProfile,
  addPhoto,
  removePhoto,
  updateLocation,
} from './profile.service';
import { uploadFileToCloud } from '../../middleware/upload.middleware';
import { deleteFromCloudinary } from '../../config/cloudinary';
import { ok, created, notFound, badRequest, serverError } from '../../utils/response';
import { prisma } from '../../config/prisma';
import { sendFirestorePushNotification } from '../../utils/firestore';

export async function completeProfile(req: Request, res: Response): Promise<void> {
  try {
    const existing = await getMyProfile(req.user!.id);
    if (existing) {
      // Profil déjà existant → mise à jour plutôt qu'erreur
      const profile = await updateProfile(req.user!.id, req.body);
      ok(res, profile, 'Profil mis à jour');
      return;
    }
    const profile = await createProfile(req.user!.id, req.body);
    created(res, profile, 'Profil créé avec succès');
  } catch (err: unknown) {
    serverError(res, err instanceof Error ? err.message : undefined);
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const profile = await getMyProfile(req.user!.id);
    if (!profile) { notFound(res, 'Profil non trouvé'); return; }
    ok(res, profile);
  } catch { serverError(res); }
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const viewerId  = req.user!.id;
    const targetId  = req.params.userId;

    // Vérifier qu'il n'y a pas de blocage dans un sens ou l'autre
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: targetId },
          { blockerId: targetId, blockedId: viewerId },
        ],
      },
    });
    if (block) { notFound(res, 'Profil introuvable'); return; }

    const profile = await getProfileById(targetId);
    if (!profile) { notFound(res, 'Profil introuvable'); return; }

    // Ne pas exposer les coordonnées GPS exactes au client
    const { latitude, longitude, ...safeProfile } = profile;
    ok(res, safeProfile);
  } catch { serverError(res); }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const profile = await updateProfile(req.user!.id, req.body);
    ok(res, profile, 'Profil mis à jour');
  } catch (err: unknown) {
    serverError(res, err instanceof Error ? err.message : undefined);
  }
}

export async function uploadPhoto(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) { badRequest(res, 'Aucune photo fournie'); return; }

    console.log('[upload] fichier reçu:', req.file.originalname,
      req.file.mimetype, req.file.size, 'bytes',
      'buffer:', req.file.buffer?.length ?? 0, 'bytes');

    const photoUrl = await uploadFileToCloud(req.file, 'affinity/photos');

    console.log('[upload] Cloudinary URL:', photoUrl);

    const profile = await addPhoto(req.user!.id, photoUrl);
    ok(res, { photos: profile.photos }, 'Photo ajoutée');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur upload';
    console.error('[upload] ERREUR:', msg);
    serverError(res, msg);
  }
}

export async function deletePhoto(req: Request, res: Response): Promise<void> {
  try {
    const index = parseInt(req.params.index, 10);
    if (isNaN(index)) { badRequest(res, 'Index invalide'); return; }

    // Récupérer l'URL avant suppression pour la retirer de Cloudinary
    const currentProfile = await getMyProfile(req.user!.id);
    const urlToDelete    = currentProfile?.photos[index];

    const profile = await removePhoto(req.user!.id, index);

    if (urlToDelete) {
      await deleteFromCloudinary(urlToDelete).catch(() => {/* non critique */});
    }

    ok(res, { photos: profile.photos }, 'Photo supprimée');
  } catch (err: unknown) {
    serverError(res, err instanceof Error ? err.message : undefined);
  }
}

export async function patchLocation(req: Request, res: Response): Promise<void> {
  try {
    const { latitude, longitude, city } = req.body as {
      latitude: number; longitude: number; city?: string;
    };
    await updateLocation(req.user!.id, latitude, longitude, city);
    ok(res, null, 'Localisation mise à jour');
  } catch { serverError(res); }
}

export async function visitProfile(req: Request, res: Response): Promise<void> {
  try {
    const visitorId  = req.user!.id;
    const profileOwnerId = req.params.userId;

    if (visitorId === profileOwnerId) { ok(res, null); return; }

    const [visitor, ownerSettings] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: visitorId }, select: { firstName: true } }),
      prisma.userSettings.findUnique({ where: { userId: profileOwnerId } }),
    ]);

    if (ownerSettings?.notifVisits !== false) {
      const visitorName = visitor?.firstName ?? 'Quelqu\'un';
      await prisma.notification.create({
        data: {
          userId: profileOwnerId,
          type:   'VISIT',
          title:  `👀 ${visitorName} a visité votre profil`,
          body:   'Découvrez qui s\'intéresse à vous',
          data:   { visitorId },
        },
      });

      if (ownerSettings?.fcmToken) {
        sendFirestorePushNotification(
          ownerSettings.fcmToken,
          `👀 ${visitorName} a visité votre profil`,
          'Découvrez qui s\'intéresse à vous',
          { type: 'VISIT', visitorId },
        ).catch(() => {});
      }
    }

    ok(res, null);
  } catch { serverError(res); }
}

export async function reportProfile(req: Request, res: Response): Promise<void> {
  try {
    const reporterId  = req.user!.id;
    const reportedId  = req.params.userId;
    const { reason }  = req.body as { reason?: string };

    if (reporterId === reportedId) { badRequest(res, 'Vous ne pouvez pas vous signaler vous-même.'); return; }

    const admins = await prisma.user.findMany({
      where:  { isAdmin: true },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type:   'SYSTEM' as const,
          title:  '🚨 Signalement de profil',
          body:   `Raison : ${reason ?? 'Non précisée'}.`,
          data:   { type: 'PROFILE_REPORT', reporterId, reportedUserId: reportedId },
        })),
      });
    }

    ok(res, null);
  } catch { serverError(res); }
}
