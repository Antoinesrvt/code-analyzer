import mongoose, { Schema, Document } from 'mongoose';
import { UserPlan } from './Analysis';

export interface IUser extends Document {
  githubId: number;
  email: string | null;
  login: string;
  name: string | null;
  avatarUrl: string;
  plan: UserPlan;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    githubId: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      sparse: true, // Allow null/undefined values
      index: true
    },
    login: {
      type: String,
      required: true
    },
    name: String,
    avatarUrl: String,
    plan: {
      type: String,
      enum: Object.values(UserPlan),
      required: true,
      default: UserPlan.BASIC
    },
    lastLoginAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

// Indexes
UserSchema.index({ githubId: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { sparse: true });
UserSchema.index({ login: 1 });

// GDPR compliance: Cascade delete user data
UserSchema.pre('deleteOne', { document: true, query: false }, async function() {
  // Delete all analyses for this user
  await mongoose.model('Analysis').deleteMany({ githubId: this.githubId });
});

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema); 