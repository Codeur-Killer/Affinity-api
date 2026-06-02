"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const auth_schemas_1 = require("./auth.schemas");
const router = (0, express_1.Router)();
// ── Firebase sync (email / Google) ────────────────────────────────────────────
router.post('/sync', (0, validate_middleware_1.validate)(auth_schemas_1.syncSchema), auth_controller_1.sync);
// ── OTP par SMS (phone) ───────────────────────────────────────────────────────
router.post('/otp/send', (0, validate_middleware_1.validate)(auth_schemas_1.sendOtpSchema), auth_controller_1.sendOtpHandler);
router.post('/otp/verify', (0, validate_middleware_1.validate)(auth_schemas_1.verifyOtpSchema), auth_controller_1.verifyOtpHandler);
// ── Routes protégées ─────────────────────────────────────────────────────────
router.get('/me', auth_middleware_1.authenticate, auth_controller_1.getMe);
router.delete('/account', auth_middleware_1.authenticate, auth_controller_1.deleteAccount);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map