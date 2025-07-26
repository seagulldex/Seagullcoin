import mongoose from 'mongoose';

const Iso20022Schema = new mongoose.Schema({
  xrpl_address: { type: String, required: true },
  wallet: { type: String, required: false, default: null },
  xlm_address: { type: String, required: false, default: null },
  flr_address: { type: String, required: false, default: null },
  hbar_address: { type: String, required: false, default: null },
  algo_address: { type: String, required: false, default: null },
  xdc_address: { type: String, required: false, default: null },
  timestamp: { type: Date, default: Date.now }
});


const Iso20022 = mongoose.models.Iso20022 || mongoose.model('Iso20022', Iso20022Schema);
export default Iso20022;
