import { Router } from 'express';
import { candidates, receivedLikes, like, pass } from './discovery.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/candidates',      candidates);
router.get('/received-likes',  receivedLikes);
router.post('/like/:userId',   like);
router.post('/pass/:userId',   pass);

export default router;
