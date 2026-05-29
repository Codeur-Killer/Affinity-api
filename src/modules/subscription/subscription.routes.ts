import { Router } from 'express';
import { getSubscription, checkout, webhook, verifyTx } from './subscription.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Webhook FedaPay — pas d'auth JWT (FedaPay appelle directement)
router.post('/webhook', webhook);

router.use(authenticate);

router.get('/', getSubscription);
router.post('/checkout', checkout);
router.get('/verify/:txId', verifyTx);

export default router;
