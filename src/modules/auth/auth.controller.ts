import { Request, Response } from 'express';
import { syncFirebaseUser, deleteUserAccount } from './auth.service';
import { sendOtp, verifyOtp }                  from './otp.service';
import { ok, created, serverError, badRequest } from '../../utils/response';

// ── Firebase sync (email / Google) ──────────────────────────────────────────
export async function sync(req: Request, res: Response): Promise<void> {
  try {
    const { firebaseToken, fcmToken } = req.body as {
      firebaseToken: string;
      fcmToken?:     string;
    };

    const result = await syncFirebaseUser(firebaseToken, fcmToken);

    created(res, {
      token:           result.token,
      isNewUser:       result.isNewUser,
      profileComplete: result.profileComplete,
      user: {
        id:       result.user.id,
        email:    result.user.email,
        phone:    result.user.phone,
        provider: result.user.provider,
        isAdmin:  result.user.isAdmin,
        isVip:    result.user.isVip,
      },
    }, result.isNewUser ? 'Compte créé avec succès' : 'Connexion réussie');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    if (message.includes('Firebase ID token') || message.includes('auth/')) {
      badRequest(res, 'Token Firebase invalide ou expiré');
    } else {
      console.error('[auth/sync]', message);
      serverError(res, message);
    }
  }
}

// ── Me (route protégée) ──────────────────────────────────────────────────────
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    ok(res, { user: req.user });
  } catch {
    serverError(res);
  }
}

// ── Suppression de compte ────────────────────────────────────────────────────
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    await deleteUserAccount(req.user!.id);
    ok(res, null, 'Compte supprimé avec succès');
  } catch {
    serverError(res);
  }
}

// ── OTP : envoi ───────────────────────────────────────────────────────────────
export async function sendOtpHandler(req: Request, res: Response): Promise<void> {
  try {
    const { phone } = req.body as { phone: string };
    await sendOtp(phone);
    ok(res, null, 'Code envoyé par SMS');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur envoi SMS';
    console.error('[auth/otp/send]', msg);
    badRequest(res, msg);
  }
}

// ── OTP : vérification ────────────────────────────────────────────────────────
export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  try {
    const { phone, code } = req.body as { phone: string; code: string };
    const result = await verifyOtp(phone, code);

    ok(res, {
      token:           result.token,
      userId:          result.userId,
      isNewUser:       result.isNewUser,
      profileComplete: result.profileComplete,
      firebaseToken:   result.firebaseToken, // custom token pour Firestore (utilisateurs OTP)
    }, result.isNewUser ? 'Compte créé avec succès' : 'Connexion réussie');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Code invalide';
    badRequest(res, msg);
  }
}
