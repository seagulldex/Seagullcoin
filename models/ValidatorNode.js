// models/ValidatorNode.js
import mongoose from 'mongoose';

const ValidatorNodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true, unique: true }, // e.g. public key or name
  publicKey: { type: String, required: true },            // for signature verification
  trusted: { type: Boolean, default: true },              // Only trusted nodes are counted
});

export default mongoose.model('ValidatorNode', ValidatorNodeSchema);
