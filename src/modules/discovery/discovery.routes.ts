import { Router } from 'express';
import { candidates, like, pass, respondLike } from './discovery.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/candidates',          candidates);
router.post('/like/:userId',        like);
router.post('/pass/:userId',        pass);
router.post('/like/respond',        respondLike); // accepter ou refuser un like reçu

export default router;
