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
import { getFileUrl } from '../../middleware/upload.middleware';
import { ok, created, notFound, badRequest, serverError } from '../../utils/response';

export async function completeProfile(req: Request, res: Response): Promise<void> {
  try {
    const existing = await getMyProfile(req.user!.id);
    if (existing) {
      badRequest(res, 'Le profil existe déjà');
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
    if (!profile) {
      notFound(res, 'Profil non trouvé');
      return;
    }
    ok(res, profile);
  } catch {
    serverError(res);
  }
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const profile = await getProfileById(req.params.userId);
    if (!profile) {
      notFound(res, 'Profil introuvable');
      return;
    }
    ok(res, profile);
  } catch {
    serverError(res);
  }
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
    if (!req.file) {
      badRequest(res, 'Aucune photo fournie');
      return;
    }
    const photoUrl = getFileUrl(req, req.file.path);
    const profile = await addPhoto(req.user!.id, photoUrl);
    ok(res, { photos: profile.photos }, 'Photo ajoutée');
  } catch (err: unknown) {
    serverError(res, err instanceof Error ? err.message : undefined);
  }
}

export async function deletePhoto(req: Request, res: Response): Promise<void> {
  try {
    const index = parseInt(req.params.index, 10);
    if (isNaN(index)) {
      badRequest(res, 'Index invalide');
      return;
    }
    const profile = await removePhoto(req.user!.id, index);
    ok(res, { photos: profile.photos }, 'Photo supprimée');
  } catch (err: unknown) {
    serverError(res, err instanceof Error ? err.message : undefined);
  }
}

export async function patchLocation(req: Request, res: Response): Promise<void> {
  try {
    const { latitude, longitude, city } = req.body as {
      latitude: number;
      longitude: number;
      city?: string;
    };
    await updateLocation(req.user!.id, latitude, longitude, city);
    ok(res, null, 'Localisation mise à jour');
  } catch {
    serverError(res);
  }
}
