import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  nif: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'guest'],
    default: 'admin',
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'verified'],
    default: 'pending',
    index: true
  },
  verificationCode: {
    type: String
  },
  verificationAttempts: {
    type: Number,
    default: 3
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    index: true
  },
  address: {
    street: { type: String, trim: true },
    number: { type: String, trim: true },
    postal: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true }
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para el nombre completo
userSchema.virtual('fullName').get(function() {
  const fName = this.name || '';
  const lName = this.lastName || '';
  const full = `${fName} ${lName}`.trim();
  return full || undefined;
});

export const User = mongoose.model('User', userSchema);
