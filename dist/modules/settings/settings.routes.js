"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_controller_1 = require("./settings.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', settings_controller_1.get);
router.put('/', settings_controller_1.update);
router.patch('/fcm-token', settings_controller_1.patchFcmToken);
exports.default = router;
//# sourceMappingURL=settings.routes.js.map