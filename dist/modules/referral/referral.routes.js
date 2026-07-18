"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const referral_controller_1 = require("./referral.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/stats', referral_controller_1.getStats);
router.post('/use', referral_controller_1.applyCode);
exports.default = router;
//# sourceMappingURL=referral.routes.js.map