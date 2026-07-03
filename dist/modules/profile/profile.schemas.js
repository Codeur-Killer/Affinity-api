"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.locationSchema = exports.updateProfileSchema = exports.createProfileSchema = void 0;
const zod_1 = require("zod");
exports.createProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).max(50),
    lastName: zod_1.z.string().max(50).optional(),
    neighborhood: zod_1.z.string().max(100).optional(),
    bio: zod_1.z.string().max(500).optional(),
    birthdate: zod_1.z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']),
    interests: zod_1.z.array(zod_1.z.string()).min(1).max(14),
    relationshipGoal: zod_1.z.enum(['FLIRT', 'LOVE']),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
    city: zod_1.z.string().max(100).optional(),
});
exports.updateProfileSchema = exports.createProfileSchema.partial().extend({
    incognito: zod_1.z.boolean().optional(),
});
exports.locationSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
    city: zod_1.z.string().max(100).optional(),
});
//# sourceMappingURL=profile.schemas.js.map