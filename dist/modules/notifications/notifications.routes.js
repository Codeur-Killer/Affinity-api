"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notifications_controller_1 = require("./notifications.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', notifications_controller_1.list);
router.patch('/read-all', notifications_controller_1.readAll);
router.patch('/:id/read', notifications_controller_1.readOne);
exports.default = router;
//# sourceMappingURL=notifications.routes.js.map