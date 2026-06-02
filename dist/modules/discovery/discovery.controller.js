"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.candidates = candidates;
exports.receivedLikes = receivedLikes;
exports.like = like;
exports.pass = pass;
const discovery_service_1 = require("./discovery.service");
const response_1 = require("../../utils/response");
async function candidates(req, res) {
    try {
        const reset = req.query.reset === 'true';
        const gender = req.query.gender;
        const minAge = req.query.minAge ? Number(req.query.minAge) : undefined;
        const maxAge = req.query.maxAge ? Number(req.query.maxAge) : undefined;
        const maxDistance = req.query.maxDistance ? Number(req.query.maxDistance) : undefined;
        const neighborhood = req.query.neighborhood;
        const profiles = await (0, discovery_service_1.getCandidates)(req.user.id, {
            reset, gender, minAge, maxAge, maxDistance, neighborhood,
        });
        (0, response_1.ok)(res, { candidates: profiles, count: profiles.length });
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function receivedLikes(req, res) {
    try {
        const likes = await (0, discovery_service_1.getReceivedLikes)(req.user.id);
        (0, response_1.ok)(res, { likes, count: likes.length });
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function like(req, res) {
    try {
        const result = await (0, discovery_service_1.likeUser)(req.user.id, req.params.userId);
        (0, response_1.ok)(res, result, result.isMatch ? 'C\'est un match !' : 'Like envoyé');
    }
    catch (err) {
        (0, response_1.badRequest)(res, err instanceof Error ? err.message : 'Erreur');
    }
}
async function pass(req, res) {
    try {
        await (0, discovery_service_1.passUser)(req.user.id, req.params.userId);
        (0, response_1.ok)(res, null, 'Profil passé');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
//# sourceMappingURL=discovery.controller.js.map