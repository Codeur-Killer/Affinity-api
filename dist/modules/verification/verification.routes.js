"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const verification_controller_1 = require("./verification.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
function handleUpload(req, res, next) {
    (0, upload_middleware_1.uploadVerification)(req, res, (err) => {
        if (err) {
            res.status(400).json({ success: false, message: err.message });
            return;
        }
        next();
    });
}
router.post('/id-card', handleUpload, verification_controller_1.uploadIdCard);
router.post('/selfie', handleUpload, verification_controller_1.uploadSelfie);
router.get('/status', verification_controller_1.status);
exports.default = router;
//# sourceMappingURL=verification.routes.js.map