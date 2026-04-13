import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  cif: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  address: {
    street: { type: String, trim: true },
    number: { type: String, trim: true },
    postal: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true }
  },
  logo: {
    type: String
  },
  isFreelance: {
    type: Boolean,
    default: false
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Agrega createdAt y updatedAt automáticamente
});

export const Company = mongoose.model('Company', companySchema);
