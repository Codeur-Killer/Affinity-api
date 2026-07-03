import { Router } from 'express';
import {
  getSubscription,
  checkout,
  mobilePay,
  mobilePayStatus,
  webhook,
  verifyTx,
  boost,
  getPlans,
} from './subscription.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Webhook FedaPay — sans auth JWT
router.post('/webhook', webhook);

router.get('/plans', getPlans); // public — sans auth

router.use(authenticate);

router.get('/',               getSubscription);
router.post('/checkout',      checkout);         // checkout web (fallback)
router.post('/mobile-pay',    mobilePay);        // paiement Mobile Money direct
router.get('/mobile-status',  mobilePayStatus);  // polling statut
router.get('/verify/:txId',   verifyTx);
router.post('/boost',         boost);

export default router;
