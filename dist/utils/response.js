"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.created = created;
exports.noContent = noContent;
exports.badRequest = badRequest;
exports.unauthorized = unauthorized;
exports.forbidden = forbidden;
exports.notFound = notFound;
exports.conflict = conflict;
exports.serverError = serverError;
function ok(res, data, message = 'Succès') {
    const body = { success: true, message, data };
    return res.status(200).json(body);
}
function created(res, data, message = 'Créé avec succès') {
    const body = { success: true, message, data };
    return res.status(201).json(body);
}
function noContent(res) {
    return res.status(204).send();
}
function badRequest(res, message, errors) {
    const body = { success: false, message, errors };
    return res.status(400).json(body);
}
function unauthorized(res, message = 'Non autorisé') {
    const body = { success: false, message };
    return res.status(401).json(body);
}
function forbidden(res, message = 'Accès refusé') {
    const body = { success: false, message };
    return res.status(403).json(body);
}
function notFound(res, message = 'Ressource introuvable') {
    const body = { success: false, message };
    return res.status(404).json(body);
}
function conflict(res, message) {
    const body = { success: false, message };
    return res.status(409).json(body);
}
function serverError(res, message = 'Erreur serveur interne') {
    const body = { success: false, message };
    return res.status(500).json(body);
}
//# sourceMappingURL=response.js.map