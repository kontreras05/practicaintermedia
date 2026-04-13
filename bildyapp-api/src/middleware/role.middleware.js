import AppError from '../utils/AppError.js';

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    // req.user debe haber sido seteado previamente por auth.middleware.js
    if (!req.user || !roles.includes(req.user.role)) {
      return next(AppError.forbidden('No tienes permiso para realizar esta acción.'));
    }
    next();
  };
};
