"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const blocks_controller_1 = require("./blocks.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', blocks_controller_1.list);
router.post('/:userId', blocks_controller_1.block);
router.delete('/:userId', blocks_controller_1.unblock);
exports.default = router;
//# sourceMappingURL=blocks.routes.js.map