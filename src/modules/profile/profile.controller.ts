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
    const profile = await getProfileById(req.params.userId);
    if (!profile) { notFound(res, 'Profil introuvable'); return; }
    ok(res, profile);
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
