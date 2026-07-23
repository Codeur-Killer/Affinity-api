import { Router, Request, Response, NextFunction } from 'express';
import {
  completeProfile,
  getMe,
  getProfile,
  update,
  uploadPhoto,
  deletePhoto,
  patchLocation,
  visitProfile,
  reportProfile,
} from './profile.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { uploadPhoto as uploadMiddleware } from '../../middleware/upload.middleware';
import { createProfileSchema, updateProfileSchema, locationSchema } from './profile.schemas';

const router = Router();

router.use(authenticate);

router.post('/complete', validate(createProfileSchema), completeProfile);
router.get('/me', getMe);
router.put('/me', validate(updateProfileSchema), update);
router.get('/:userId', getProfile);
router.post('/:userId/visit',  visitProfile);
router.post('/:userId/report', reportProfile);
router.patch('/me/location', validate(locationSchema), patchLocation);

router.post('/me/photos', (req: Request, res: Response, next: NextFunction) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    next();
  });
}, uploadPhoto);

router.delete('/me/photos/:index', deletePhoto);

export default router;
