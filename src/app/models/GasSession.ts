// models/GasSession.ts
import mongoose, { Schema, model, models } from 'mongoose';

const GasSessionSchema = new Schema({
  userEmail: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  userImage: { type: String },
  startTime: { type: Date, required: true },
  endTime: { type: Date, default: null }, 
  durationInSeconds: { type: Number, default: 0 },
}, { timestamps: true });

GasSessionSchema.index({ userEmail: 1, startTime: 1 });
GasSessionSchema.index({ startTime: 1 });

export const GasSession = models.GasSession || model('GasSession', GasSessionSchema);