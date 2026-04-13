import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploadLogo } from '../middleware/upload.js';

import {
  register,
  validateEmail,
  login,
  updatePersonalData,
  updateCompanyData,
  uploadUserLogo,
  getUser,
  refreshToken,
  logout,
  deleteUser,
  updatePassword,
  inviteUser
} from '../controllers/user.controller.js';

import {
  registerSchema,
  validateAccountSchema,
  loginSchema,
  onboardingPersonalSchema,
  onboardingCompanySchema,
  updatePasswordSchema,
  inviteUserSchema
} from '../validators/user.validator.js';

const router = Router();

// ---- RUTAS PÚBLICAS ----
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refreshToken);

// ---- RUTAS PROTEGIDAS ----
router.use(requireAuth);

router.put('/validation', validate(validateAccountSchema), validateEmail);
router.post('/logout', logout);

// Onboarding
router.put('/register', validate(onboardingPersonalSchema), updatePersonalData);
router.patch('/company', validate(onboardingCompanySchema), updateCompanyData);
router.patch('/logo', uploadLogo, uploadUserLogo);

// Gestión total
router.get('/', getUser);
router.put('/password', validate(updatePasswordSchema), updatePassword);
router.delete('/', deleteUser);

// Invitaciones (solo admin)
router.post('/invite', restrictTo('admin'), validate(inviteUserSchema), inviteUser);

export default router;
