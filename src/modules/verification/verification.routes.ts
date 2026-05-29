import { Router, Request, Response, NextFunction } from 'express';
import { uploadIdCard, uploadSelfie, status } from './verification.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { uploadVerification } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadVerification(req, res, (err) => {
    if (err) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    next();
  });
};

router.post('/id-card', handleUpload, uploadIdCard);
router.post('/selfie', handleUpload, uploadSelfie);
router.get('/status', status);

export default router;
