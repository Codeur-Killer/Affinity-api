"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCloudinary = initCloudinary;
exports.uploadToCloudinary = uploadToCloudinary;
exports.deleteFromCloudinary = deleteFromCloudinary;
const cloudinary_1 = require("cloudinary");
const env_1 = require("./env");
function initCloudinary() {
    if (!env_1.env.CLOUDINARY_CLOUD_NAME || !env_1.env.CLOUDINARY_API_KEY || !env_1.env.CLOUDINARY_API_SECRET) {
        console.error('❌ Cloudinary : variables manquantes →', 'CLOUDINARY_CLOUD_NAME:', !!env_1.env.CLOUDINARY_CLOUD_NAME, 'CLOUDINARY_API_KEY:', !!env_1.env.CLOUDINARY_API_KEY, 'CLOUDINARY_API_SECRET:', !!env_1.env.CLOUDINARY_API_SECRET);
        throw new Error('Cloudinary non configuré — vérifiez les variables d\'environnement');
    }
    cloudinary_1.v2.config({
        cloud_name: env_1.env.CLOUDINARY_CLOUD_NAME,
        api_key: env_1.env.CLOUDINARY_API_KEY,
        api_secret: env_1.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
    console.log('✅ Cloudinary initialisé (cloud:', env_1.env.CLOUDINARY_CLOUD_NAME, ')');
}
async function uploadToCloudinary(buffer, folder = 'affinity', publicId) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            public_id: publicId,
            resource_type: 'image',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        }, (error, result) => {
            if (error || !result) {
                reject(error ?? new Error('Cloudinary: résultat vide'));
            }
            else {
                resolve(result.secure_url);
            }
        });
        stream.end(buffer);
    });
}
async function deleteFromCloudinary(url) {
    try {
        // Extraire le public_id depuis l'URL Cloudinary
        const match = url.match(/\/v\d+\/(.+)\.\w+$/);
        if (match) {
            await cloudinary_1.v2.uploader.destroy(match[1]);
        }
    }
    catch {
        /* non critique */
    }
}
//# sourceMappingURL=cloudinary.js.map