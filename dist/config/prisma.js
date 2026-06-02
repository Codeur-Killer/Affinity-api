"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
const client_1 = require("@prisma/client");
const env_1 = require("./env");
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ||
    new client_1.PrismaClient({
        log: env_1.env.IS_DEV ? ['query', 'error', 'warn'] : ['error'],
    });
if (env_1.env.IS_DEV) {
    globalForPrisma.prisma = exports.prisma;
}
async function connectDB() {
    await exports.prisma.$connect();
    console.log('✅ Connecté à PostgreSQL (Neon)');
}
async function disconnectDB() {
    await exports.prisma.$disconnect();
}
//# sourceMappingURL=prisma.js.map