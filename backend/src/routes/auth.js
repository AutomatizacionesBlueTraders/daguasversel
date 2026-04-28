const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { loginLimiter, passwordResetLimiter } = require('../middleware/rateLimit');
const auth = require('../controllers/authController');
const users = require('../controllers/usersController');

const router = express.Router();

// Auth público
router.post('/login', loginLimiter, asyncH(auth.login));
router.post('/refresh', asyncH(auth.refresh));
router.post('/forgot-password', passwordResetLimiter, asyncH(auth.forgotPassword));
router.post('/reset-password', passwordResetLimiter, asyncH(auth.resetPasswordWithToken));
router.post('/reset-password-with-code', passwordResetLimiter, asyncH(auth.resetPasswordWithCode));

// Auth privado
router.post('/logout', requireAuth, asyncH(auth.logout));
router.get('/me', requireAuth, asyncH(auth.me));
router.post('/change-password', requireAuth, asyncH(auth.changePassword));

// Usuarios (solo admin)
router.get('/users', requireAuth, requireRole('admin'), asyncH(users.listUsers));
router.post('/users', requireAuth, requireRole('admin'), asyncH(users.createUser));
router.patch('/users/:id', requireAuth, requireRole('admin'), asyncH(users.updateUser));
router.delete('/users/:id', requireAuth, requireRole('admin'), asyncH(users.deleteUser));
router.post('/users/:id/resend-invite', requireAuth, requireRole('admin'), asyncH(users.resendInvite));

function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = router;
