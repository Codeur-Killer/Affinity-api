import { Router } from 'express';
import { candidates, receivedLikes, like, pass, undoPass, likeRespond } from './discovery.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/candidates',       candidates);
router.get('/received-likes',   receivedLikes);
router.post('/like/respond',    likeRespond);   // AVANT /like/:userId
router.post('/like/:userId',    like);
router.post('/pass/:userId',    pass);
router.delete('/pass/:userId',  undoPass);

export default router;
