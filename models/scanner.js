const mongoose = require("mongoose")

// Define a schema for storing data
const dataSchema = new mongoose.Schema({
  rawData: String,
  parsedData: {
    type: { type: String },
    status: String,
    productCode: String,
    serialNumber: String,
    counter: Number,
  },
  isValid: Boolean,
  errorMessage: String,
  timestamp: { type: Date, default: Date.now },
})

// Create models for each scanner
const Scanner1Model = mongoose.model("Scanner1Data", dataSchema)
const Scanner2Model = mongoose.model("Scanner2Data", dataSchema)
const Scanner3Model = mongoose.model("Scanner3Data", dataSchema)
const Scanner4Model = mongoose.model("Scanner4Data", dataSchema)
const Scanner5Model = mongoose.model("Scanner5Data", dataSchema)
const Scanner6Model = mongoose.model("Scanner6Data", dataSchema)
const Scanner7Model = mongoose.model("Scanner7Data", dataSchema)

module.exports = {
  Scanner1Model,
  Scanner2Model,
  Scanner3Model,
  Scanner4Model,
  Scanner5Model,
  Scanner6Model,
  Scanner7Model,
  dataSchema,
}

