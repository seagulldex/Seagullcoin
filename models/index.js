import mongoose from 'mongoose';
import assetRegistrySchema from './AssetRegistry.js';
import isoMessageSchema from './isoMessageSchema.js';
import bridgeHistorySchema from './bridgeHistorySchema.js';

const AssetRegistry = mongoose.model('AssetRegistry', assetRegistrySchema);
const IsoMessage = mongoose.model('IsoMessage', isoMessageSchema);
const BridgeHistory = mongoose.model('BridgeHistory', bridgeHistorySchema);

export { AssetRegistry, IsoMessage, BridgeHistory };
