import mongoose from 'mongoose';

const Iso20022Schema = new mongoose.Schema({
  xrpl_address: { type: String, default: null },
  wallet: { type: String, default: null },
  xlm_address: { type: String, default: null },
  flr_address: { type: String, default: null },
  hbar_address: { type: String, default: null },
  algo_address: { type: String, default: null },
  xdc_address: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  xumm_uuid: { type: String, default: null }
});

const Iso20022 = mongoose.models.Iso20022 || mongoose.model('Iso20022', Iso20022Schema);
export default Iso20022;
