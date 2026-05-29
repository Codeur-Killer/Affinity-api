import { Response } from 'express';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
}

export function ok<T>(res: Response, data: T, message = 'Succès'): Response {
  const body: ApiResponse<T> = { success: true, message, data };
  return res.status(200).json(body);
}

export function created<T>(res: Response, data: T, message = 'Créé avec succès'): Response {
  const body: ApiResponse<T> = { success: true, message, data };
  return res.status(201).json(body);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function badRequest(res: Response, message: string, errors?: unknown): Response {
  const body: ApiResponse = { success: false, message, errors };
  return res.status(400).json(body);
}

export function unauthorized(res: Response, message = 'Non autorisé'): Response {
  const body: ApiResponse = { success: false, message };
  return res.status(401).json(body);
}

export function forbidden(res: Response, message = 'Accès refusé'): Response {
  const body: ApiResponse = { success: false, message };
  return res.status(403).json(body);
}

export function notFound(res: Response, message = 'Ressource introuvable'): Response {
  const body: ApiResponse = { success: false, message };
  return res.status(404).json(body);
}

export function conflict(res: Response, message: string): Response {
  const body: ApiResponse = { success: false, message };
  return res.status(409).json(body);
}

export function serverError(res: Response, message = 'Erreur serveur interne'): Response {
  const body: ApiResponse = { success: false, message };
  return res.status(500).json(body);
}
