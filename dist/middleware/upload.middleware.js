"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadVerification = exports.uploadPhoto = void 0;
exports.uploadFileToCloud = uploadFileToCloud;
const multer_1 = __importDefault(require("multer"));
const env_1 = require("../config/env");
const cloudinary_1 = require("../config/cloudinary");
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
function fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Format non supporté. Utilisez JPEG, PNG ou WebP.'));
    }
}
// Stockage en mémoire → upload direct vers Cloudinary
const memStorage = multer_1.default.memoryStorage();
const multerOpts = {
    storage: memStorage,
    limits: { fileSize: env_1.env.MAX_FILE_SIZE_BYTES },
    fileFilter,
};
exports.uploadPhoto = (0, multer_1.default)(multerOpts).single('photo');
exports.uploadVerification = (0, multer_1.default)(multerOpts).fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
]);
/** Upload vers Cloudinary — retourne l'URL sécurisée */
async function uploadFileToCloud(file, folder) {
    if (!file.buffer || file.buffer.length === 0) {
        throw new Error('Fichier vide ou invalide');
    }
    return (0, cloudinary_1.uploadToCloudinary)(file.buffer, folder);
}
//# sourceMappingURL=upload.middleware.js.map