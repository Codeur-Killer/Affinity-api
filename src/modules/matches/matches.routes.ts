import { Router } from 'express';
import { list, getOne, remove } from './matches.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.get('/:matchId', getOne);
router.delete('/:matchId', remove);

export default router;
