"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.readOne = readOne;
exports.readAll = readAll;
const notifications_service_1 = require("./notifications.service");
const response_1 = require("../../utils/response");
async function list(req, res) {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const result = await (0, notifications_service_1.getNotifications)(req.user.id, page);
        (0, response_1.ok)(res, result);
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function readOne(req, res) {
    try {
        const done = await (0, notifications_service_1.markOneRead)(req.params.id, req.user.id);
        if (!done) {
            (0, response_1.notFound)(res, 'Notification introuvable');
            return;
        }
        (0, response_1.ok)(res, null, 'Notification marquée comme lue');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function readAll(req, res) {
    try {
        await (0, notifications_service_1.markAllRead)(req.user.id);
        (0, response_1.ok)(res, null, 'Toutes les notifications ont été lues');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
//# sourceMappingURL=notifications.controller.js.map