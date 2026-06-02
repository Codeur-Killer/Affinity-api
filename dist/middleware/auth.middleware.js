"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jwt_1 = require("../utils/jwt");
const response_1 = require("../utils/response");
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        (0, response_1.unauthorized)(res, 'Token manquant ou invalide');
        return;
    }
    const token = header.split(' ')[1];
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        req.user = {
            id: payload.userId,
            firebaseUid: payload.firebaseUid,
            email: payload.email,
        };
        next();
    }
    catch {
        (0, response_1.unauthorized)(res, 'Token expiré ou invalide');
    }
}
//# sourceMappingURL=auth.middleware.js.map