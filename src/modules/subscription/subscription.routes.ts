import { Router, Request, Response, NextFunction } from 'express';
import {
  getSubscription,
  checkout,
  mobilePay,
  mobilePayStatus,
  webhook,
  verifyTx,
  boost,
  getPlans,
  devConfirm,
  validateCode,
} from './subscription.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { env } from '../../config/env';

const router = Router();

// Webhook FedaPay — sans auth JWT, protégé par token secret dans l'URL
// Configurer FedaPay pour appeler : /api/subscription/webhook?token=FEDAPAY_WEBHOOK_SECRET
function webhookGuard(req: Request, res: Response, next: NextFunction): void {
  const secret = env.FEDAPAY_WEBHOOK_SECRET;
  if (secret) {
    const token = (req.query.token as string | undefined) ?? req.headers['x-webhook-secret'];
    if (token !== secret) {
      res.status(401).json({ success: false, message: 'Token webhook invalide' });
      return;
    }
  }
  next();
}
router.post('/webhook', webhookGuard, webhook);

router.get('/plans', getPlans); // public — sans auth

router.use(authenticate);

router.get('/',               getSubscription);
router.get('/validate-code',  validateCode);   // validation code VIP (auth requis)
router.post('/checkout',      checkout);         // checkout web (fallback)
router.post('/mobile-pay',    mobilePay);        // paiement Mobile Money direct
router.get('/mobile-status',  mobilePayStatus);  // polling statut
router.get('/verify/:txId',   verifyTx);
router.post('/boost',        boost);
router.post('/dev-confirm',  devConfirm); // sandbox/dev uniquement — bloqué en production

export default router;
