"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.stats = stats;
exports.chart = chart;
exports.users = users;
exports.banUser = banUser;
exports.promoteUser = promoteUser;
exports.verifications = verifications;
exports.reviewVerification = reviewVerification;
exports.subscriptions = subscriptions;
const svc = __importStar(require("./admin.service"));
const response_1 = require("../../utils/response");
async function stats(req, res) {
    try {
        (0, response_1.ok)(res, await svc.getStats());
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function chart(req, res) {
    try {
        (0, response_1.ok)(res, await svc.getRegistrationChart());
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function users(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        (0, response_1.ok)(res, await svc.getUsers(page, limit, search));
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function banUser(req, res) {
    try {
        const { banned } = req.body;
        (0, response_1.ok)(res, await svc.banUser(req.params.userId, banned), banned ? 'Utilisateur banni' : 'Utilisateur réactivé');
    }
    catch (e) {
        (0, response_1.badRequest)(res, e instanceof Error ? e.message : 'Erreur');
    }
}
async function promoteUser(req, res) {
    try {
        const { isAdmin } = req.body;
        (0, response_1.ok)(res, await svc.promoteUser(req.params.userId, isAdmin), isAdmin ? 'Promu administrateur' : 'Droits admin retirés');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function verifications(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        (0, response_1.ok)(res, await svc.getPendingVerifications(page, limit));
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function reviewVerification(req, res) {
    try {
        const { approved } = req.body;
        if (approved === undefined) {
            (0, response_1.badRequest)(res, 'approved requis');
            return;
        }
        (0, response_1.ok)(res, await svc.reviewVerification(req.params.userId, approved), approved ? 'Profil vérifié ✓' : 'Vérification rejetée');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function subscriptions(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        (0, response_1.ok)(res, await svc.getSubscriptions(page, limit));
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
//# sourceMappingURL=admin.controller.js.map