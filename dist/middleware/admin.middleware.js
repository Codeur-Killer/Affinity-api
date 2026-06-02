"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
const prisma_1 = require("../config/prisma");
const response_1 = require("../utils/response");
/** Vérifie que l'utilisateur authentifié est un administrateur */
async function requireAdmin(req, res, next) {
    const userId = req.user?.id;
    if (!userId) {
        (0, response_1.forbidden)(res, 'Non authentifié');
        return;
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
        (0, response_1.forbidden)(res, 'Accès réservé aux administrateurs');
        return;
    }
    next();
}
//# sourceMappingURL=admin.middleware.js.map