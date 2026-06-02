"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
exports.globalErrorHandler = globalErrorHandler;
const env_1 = require("../config/env");
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} introuvable`,
    });
}
function globalErrorHandler(err, req, res, _next) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err.message);
    res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        ...(env_1.env.IS_DEV && { stack: err.stack }),
    });
}
//# sourceMappingURL=error.middleware.js.map