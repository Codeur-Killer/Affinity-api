import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin }  from '../../middleware/admin.middleware';
import * as ctrl from './admin.controller';

const router = Router();

// Toutes les routes admin nécessitent d'être authentifié ET admin
router.use(authenticate, requireAdmin);

router.get('/stats',                          ctrl.stats);
router.get('/chart/registrations',            ctrl.chart);
router.get('/users',                          ctrl.users);
router.patch('/users/:userId/ban',            ctrl.banUser);
router.patch('/users/:userId/promote',        ctrl.promoteUser);
router.get('/verifications',                  ctrl.verifications);
router.patch('/verifications/:userId/review', ctrl.reviewVerification);
router.get('/subscriptions',                  ctrl.subscriptions);

router.get('/vip',              ctrl.listVips);
router.post('/vip',             ctrl.createVip);
router.put('/vip/:userId',      ctrl.updateVip);
router.delete('/vip/:userId',   ctrl.revokeVip);

router.get('/admins',                          ctrl.listAdmins);
router.post('/admins',                         ctrl.createAdmin);
router.delete('/admins/:userId',               ctrl.removeAdmin);

router.get('/vip-withdrawals',                 ctrl.listVipWithdrawals);
router.patch('/vip-withdrawals/:id/review',    ctrl.reviewWithdrawal);

export default router;
