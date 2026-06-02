"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadIdCard = uploadIdCard;
exports.uploadSelfie = uploadSelfie;
exports.status = status;
const verification_service_1 = require("./verification.service");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const response_1 = require("../../utils/response");
async function uploadIdCard(req, res) {
    try {
        const files = req.files;
        const front = files?.['idFront']?.[0];
        const back = files?.['idBack']?.[0];
        console.log('[verification/id-card] files reçus:', {
            idFront: front ? `${front.originalname} (${front.size} bytes)` : 'manquant',
            idBack: back ? `${back.originalname}  (${back.size} bytes)` : 'manquant',
        });
        if (!front || !back) {
            (0, response_1.badRequest)(res, 'idFront et idBack sont requis');
            return;
        }
        const [frontUrl, backUrl] = await Promise.all([
            (0, upload_middleware_1.uploadFileToCloud)(front, 'affinity/verification'),
            (0, upload_middleware_1.uploadFileToCloud)(back, 'affinity/verification'),
        ]);
        console.log('[verification/id-card] uploadés →', frontUrl, backUrl);
        const verification = await (0, verification_service_1.submitIdCard)(req.user.id, frontUrl, backUrl);
        (0, response_1.ok)(res, verification, "Carte d'identité soumise avec succès");
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur upload';
        console.error('[verification/id-card] ERREUR:', msg);
        (0, response_1.serverError)(res, msg);
    }
}
async function uploadSelfie(req, res) {
    try {
        const files = req.files;
        const file = files?.['selfie']?.[0];
        console.log('[verification/selfie] fichier reçu:', file ? `${file.originalname} (${file.size} bytes)` : 'manquant');
        if (!file) {
            (0, response_1.badRequest)(res, 'Selfie requis');
            return;
        }
        const selfieUrl = await (0, upload_middleware_1.uploadFileToCloud)(file, 'affinity/verification');
        console.log('[verification/selfie] uploadé →', selfieUrl);
        const verification = await (0, verification_service_1.submitSelfie)(req.user.id, selfieUrl);
        (0, response_1.ok)(res, verification, 'Selfie soumis avec succès');
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur upload';
        console.error('[verification/selfie] ERREUR:', msg);
        (0, response_1.serverError)(res, msg);
    }
}
async function status(req, res) {
    try {
        const verification = await (0, verification_service_1.getVerificationStatus)(req.user.id);
        (0, response_1.ok)(res, verification ?? { status: 'NOT_SUBMITTED' });
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
//# sourceMappingURL=verification.controller.js.map