import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, match: /^[a-zA-Z\s]{2,50}$/ },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phonenumber:{type:String,required:true},
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String},
   profilePictureUrl: { type: String, default: '' } 
}, { timestamps: true });


userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcryptjs.hash(this.password, 10);
  next();
});

export default mongoose.model('User', userSchema);