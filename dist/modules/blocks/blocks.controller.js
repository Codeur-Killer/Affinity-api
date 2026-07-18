"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.block = block;
exports.unblock = unblock;
const response_1 = require("../../utils/response");
const blocks_service_1 = require("./blocks.service");
async function list(req, res) {
    (0, response_1.ok)(res, { blocks: await (0, blocks_service_1.getBlockedUsers)(req.user.id) });
}
async function block(req, res) {
    const { userId } = req.params;
    try {
        await (0, blocks_service_1.blockUser)(req.user.id, userId);
        (0, response_1.ok)(res, { message: 'Utilisateur bloqué.' });
    }
    catch (e) {
        (0, response_1.badRequest)(res, e instanceof Error ? e.message : 'Erreur');
    }
}
async function unblock(req, res) {
    await (0, blocks_service_1.unblockUser)(req.user.id, req.params.userId);
    (0, response_1.ok)(res, { message: 'Utilisateur débloqué.' });
}
//# sourceMappingURL=blocks.controller.js.map