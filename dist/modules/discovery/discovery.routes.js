"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const discovery_controller_1 = require("./discovery.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/candidates', discovery_controller_1.candidates);
router.get('/received-likes', discovery_controller_1.receivedLikes);
router.post('/like/:userId', discovery_controller_1.like);
router.post('/pass/:userId', discovery_controller_1.pass);
exports.default = router;
//# sourceMappingURL=discovery.routes.js.map