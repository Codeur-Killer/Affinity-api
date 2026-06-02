"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getOne = getOne;
exports.remove = remove;
const matches_service_1 = require("./matches.service");
const response_1 = require("../../utils/response");
async function list(req, res) {
    try {
        const matches = await (0, matches_service_1.getMyMatches)(req.user.id);
        (0, response_1.ok)(res, { matches, count: matches.length });
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function getOne(req, res) {
    try {
        const match = await (0, matches_service_1.getMatchById)(req.params.matchId, req.user.id);
        if (!match) {
            (0, response_1.notFound)(res, 'Match introuvable');
            return;
        }
        (0, response_1.ok)(res, match);
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function remove(req, res) {
    try {
        const deleted = await (0, matches_service_1.unmatch)(req.params.matchId, req.user.id);
        if (!deleted) {
            (0, response_1.forbidden)(res, 'Action non autorisée');
            return;
        }
        (0, response_1.ok)(res, null, 'Match supprimé');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
//# sourceMappingURL=matches.controller.js.map