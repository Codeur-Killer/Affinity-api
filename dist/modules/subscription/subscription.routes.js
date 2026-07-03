"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscription_controller_1 = require("./subscription.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Webhook FedaPay — sans auth JWT
router.post('/webhook', subscription_controller_1.webhook);
router.get('/plans', subscription_controller_1.getPlans); // public — sans auth
router.use(auth_middleware_1.authenticate);
router.get('/', subscription_controller_1.getSubscription);
router.post('/checkout', subscription_controller_1.checkout); // checkout web (fallback)
router.post('/mobile-pay', subscription_controller_1.mobilePay); // paiement Mobile Money direct
router.get('/mobile-status', subscription_controller_1.mobilePayStatus); // polling statut
router.get('/verify/:txId', subscription_controller_1.verifyTx);
router.post('/boost', subscription_controller_1.boost);
exports.default = router;
//# sourceMappingURL=subscription.routes.js.map