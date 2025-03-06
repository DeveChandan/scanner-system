const express = require("express")
const mongoose = require("mongoose")
const scannerManager = require("./scannerManager")
const config = require("./config")
const apiRoutes = require("./routes/api")
const productionApiRoutes = require("./routes/production-api")
const connectionMonitorRoutes = require("./dashboard/connection-monitor")
const productionDashboardRoutes = require("./dashboard/production-dashboard")

// Create Express app
const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())
app.use(express.static("public"))

// Set strictQuery to true to address the deprecation warning
mongoose.set("strictQuery", true)

// MongoDB connection
mongoose
  .connect(config.mongoURI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err))

// API routes
app.use("/api", apiRoutes)
app.use("/api", productionApiRoutes)

// Dashboard routes
app.use("/dashboard/connection-monitor", connectionMonitorRoutes)
app.use("/dashboard/production", productionDashboardRoutes) // This line is correct

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date() })
})

// Root route - redirect to connection monitor dashboard
app.get("/", (req, res) => {
  res.redirect("/dashboard/connection-monitor")
})

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)

  // Initialize scanner connections
  scannerManager.initializeScanners()
})

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  scannerManager.disconnectAll()
  mongoose.connection.close()
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully")
  scannerManager.disconnectAll()
  mongoose.connection.close()
  process.exit(0)
})

