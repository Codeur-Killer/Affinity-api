"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profile_controller_1 = require("./profile.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const profile_schemas_1 = require("./profile.schemas");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.post('/complete', (0, validate_middleware_1.validate)(profile_schemas_1.createProfileSchema), profile_controller_1.completeProfile);
router.get('/me', profile_controller_1.getMe);
router.put('/me', (0, validate_middleware_1.validate)(profile_schemas_1.updateProfileSchema), profile_controller_1.update);
router.get('/:userId', profile_controller_1.getProfile);
router.patch('/me/location', (0, validate_middleware_1.validate)(profile_schemas_1.locationSchema), profile_controller_1.patchLocation);
router.post('/me/photos', (req, res, next) => {
    (0, upload_middleware_1.uploadPhoto)(req, res, (err) => {
        if (err) {
            res.status(400).json({ success: false, message: err.message });
            return;
        }
        next();
    });
}, profile_controller_1.uploadPhoto);
router.delete('/me/photos/:index', profile_controller_1.deletePhoto);
exports.default = router;
//# sourceMappingURL=profile.routes.js.map