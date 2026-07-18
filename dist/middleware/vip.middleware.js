"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireVip = requireVip;
const prisma_1 = require("../config/prisma");
const response_1 = require("../utils/response");
async function requireVip(req, res, next) {
    const userId = req.user?.id;
    if (!userId) {
        (0, response_1.forbidden)(res, 'Non authentifié');
        return;
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { isVip: true },
    });
    if (!user?.isVip) {
        (0, response_1.forbidden)(res, 'Accès réservé aux comptes VIP');
        return;
    }
    next();
}
//# sourceMappingURL=vip.middleware.js.map