"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const matches_controller_1 = require("./matches.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', matches_controller_1.list);
router.get('/:matchId', matches_controller_1.getOne);
router.delete('/:matchId', matches_controller_1.remove);
exports.default = router;
//# sourceMappingURL=matches.routes.js.map