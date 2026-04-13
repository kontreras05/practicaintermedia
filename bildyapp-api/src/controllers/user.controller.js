import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { notificationService } from '../services/notification.service.js';

// ---- HELPERS ----
const signToken = (id, expiresIn) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn
  });
};

const createSendTokens = (user, res) => {
  const accessToken = signToken(user._id, '15m');
  const refreshToken = signToken(user._id, '7d');

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        email: user.email,
        status: user.status,
        role: user.role
      },
      accessToken,
      refreshToken
    }
  });
};

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ---- ENDPOINTS ----

export const register = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(AppError.conflict('El email ya está registrado.'));
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationCode = generateCode();

    const newUser = await User.create({
      email,
      password: hashedPassword,
      verificationCode,
      verificationAttempts: 3,
      role: 'admin' // Por defecto
    });

    notificationService.emit('user:registered', { email: newUser.email });

    createSendTokens(newUser, res);
  } catch (error) {
    next(error);
  }
};

export const validateEmail = async (req, res, next) => {
  try {
    const { code } = req.body;
    const user = req.user;

    if (user.status === 'verified') {
      return next(AppError.badRequest('El usuario ya está verificado.'));
    }

    if (user.verificationAttempts <= 0) {
      return next(AppError.tooManyRequests('Has agotado los intentos de verificación.'));
    }

    if (user.verificationCode !== code) {
      user.verificationAttempts -= 1;
      await user.save({ validateBeforeSave: false });
      return next(AppError.badRequest(`Código incorrecto. Intentos restantes: ${user.verificationAttempts}`));
    }

    user.status = 'verified';
    user.verificationCode = undefined;
    await user.save({ validateBeforeSave: false });

    notificationService.emit('user:verified', { email: user.email });

    res.status(200).json({
      status: 'success',
      message: 'Email verificado correctamente.'
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || user.deleted) {
      return next(AppError.unauthorized('Email o contraseña incorrectos.'));
    }

    const correct = await bcrypt.compare(password, user.password);
    if (!correct) {
      return next(AppError.unauthorized('Email o contraseña incorrectos.'));
    }

    createSendTokens(user, res);
  } catch (error) {
    next(error);
  }
};

export const updatePersonalData = async (req, res, next) => {
  try {
    const { name, lastName, nif } = req.body;
    const user = req.user;

    user.name = name;
    user.lastName = lastName;
    user.nif = nif;

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

export const updateCompanyData = async (req, res, next) => {
  try {
    const { name, cif, address, isFreelance } = req.body;
    const user = req.user;

    let targetCif = isFreelance ? user.nif : cif;
    let targetName = isFreelance ? (user.fullName || user.name) : name;
    let targetAddress = isFreelance ? user.address : address;

    if (!targetCif) {
      return next(AppError.badRequest('Requerimos proveer un CIF o tener un NIF previo si eres freelance.'));
    }

    let company = await Company.findOne({ cif: targetCif });

    if (!company) {
      company = await Company.create({
        owner: user._id,
        name: targetName,
        cif: targetCif,
        address: targetAddress,
        isFreelance
      });
      // El usuario mantiene rol 'admin' al ser el owner
    } else {
      user.role = 'guest'; // Se une a una empresa existente
    }

    user.company = company._id;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: { company, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};

export const uploadUserLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(AppError.badRequest('Por favor sube un archivo de imagen.'));
    }

    if (!req.user.company) {
      return next(AppError.badRequest('El usuario no tiene una compañía asociada.'));
    }

    const company = await Company.findById(req.user.company);
    if (!company) {
      return next(AppError.notFound('Compañía no encontrada.'));
    }

    company.logo = `/uploads/${req.file.filename}`;
    await company.save();

    res.status(200).json({
      status: 'success',
      data: { logo: company.logo }
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('company');
    
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const token = req.body.refreshToken;
    if (!token) {
      return next(AppError.unauthorized('No se proveyó un token de refresco.'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(AppError.unauthorized('El usuario asignado al token ya no existe.'));
    }

    const newAccessToken = signToken(user._id, '15m');
    const newRefreshToken = signToken(user._id, '7d');

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    return next(AppError.unauthorized('Token de refresco inválido o expirado.'));
  }
};

export const logout = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Cierre de sesión exitoso.'
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const soft = req.query.soft === 'true';

    if (soft) {
      req.user.deleted = true;
      await req.user.save({ validateBeforeSave: false });
      notificationService.emit('user:deleted', { email: req.user.email });
    } else {
      await User.findByIdAndDelete(req.user._id);
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const correct = await bcrypt.compare(currentPassword, user.password);
    if (!correct) {
      return next(AppError.unauthorized('La contraseña actual es incorrecta.'));
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save({ validateBeforeSave: false });

    createSendTokens(user, res);
  } catch (error) {
    next(error);
  }
};

export const inviteUser = async (req, res, next) => {
  try {
    const { email, name, lastName } = req.body;
    const company = req.user.company;

    if (!company) {
      return next(AppError.badRequest('No estás asociado a ninguna empresa.'));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(AppError.conflict('El email de invitado ya está registrado.'));
    }

    const mockPassword = await bcrypt.hash(Math.random().toString(36).slice(-8), 12);

    const newUser = await User.create({
      email,
      name,
      lastName,
      password: mockPassword,
      role: 'guest',
      company: company._id,
      status: 'pending',
      verificationCode: generateCode()
    });

    notificationService.emit('user:invited', { email: newUser.email, company });

    res.status(201).json({
      status: 'success',
      data: {
        user: { email: newUser.email, role: newUser.role, company: newUser.company }
      }
    });
  } catch (error) {
    next(error);
  }
};
