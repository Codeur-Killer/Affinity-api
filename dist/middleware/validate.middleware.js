"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const response_1 = require("../utils/response");
function validate(schema, target = 'body') {
    return (req, res, next) => {
        const result = schema.safeParse(req[target]);
        if (!result.success) {
            const errors = result.error.flatten().fieldErrors;
            (0, response_1.badRequest)(res, 'Données invalides', errors);
            return;
        }
        req[target] = result.data;
        next();
    };
}
//# sourceMappingURL=validate.middleware.js.map