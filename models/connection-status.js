const mongoose = require("mongoose")

// Define a schema for storing connection status
const connectionStatusSchema = new mongoose.Schema({
  scannerId: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["connected", "disconnected"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  ipAddress: String,
  port: Number,
  reconnectAttempts: {
    type: Number,
    default: 0,
  },
  errorMessage: String,
})

// Create index for efficient querying
connectionStatusSchema.index({ scannerId: 1, timestamp: -1 })

const ConnectionStatus = mongoose.model("ConnectionStatus", connectionStatusSchema)

module.exports = ConnectionStatus

