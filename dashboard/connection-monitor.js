const express = require("express")
const router = express.Router()
const path = require("path")
const ConnectionStatus = require("../models/connection-status")
const scannerManager = require("../scannerManager")

// Serve the connection monitor dashboard
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/connection-monitor.html"))
})

// Get data for the dashboard
router.get("/data", async (req, res) => {
  try {
    // Get current status
    const currentStatus = scannerManager.getConnectionStatus()

    // Get recent disconnections (last 24 hours)
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const recentDisconnections = await ConnectionStatus.find({
      status: "disconnected",
      timestamp: { $gte: oneDayAgo },
    })
      .sort({ timestamp: -1 })
      .limit(100)

    // Get scanner uptime for the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Get all scanners
    const scannerIds = Object.keys(currentStatus)

    // Calculate uptime for each scanner
    const uptimeData = {}

    for (const scannerId of scannerIds) {
      // Get all status changes in the last 7 days
      const statusChanges = await ConnectionStatus.find({
        scannerId,
        timestamp: { $gte: sevenDaysAgo },
      }).sort({ timestamp: 1 })

      // Calculate daily uptime
      const dailyUptime = {}
      const currentDay = new Date(sevenDaysAgo)
      let lastStatus = "disconnected"
      let lastStatusTime = new Date(sevenDaysAgo)

      // Initialize daily uptime for all 7 days
      for (let i = 0; i < 7; i++) {
        const day = new Date(sevenDaysAgo)
        day.setDate(day.getDate() + i)
        const dateStr = day.toISOString().split("T")[0]
        dailyUptime[dateStr] = {
          connectedMs: 0,
          totalMs: 24 * 60 * 60 * 1000, // 24 hours in ms
          uptime: 0,
        }
      }

      // Process status changes
      for (const change of statusChanges) {
        const changeDay = change.timestamp.toISOString().split("T")[0]

        // If we have a previous status, calculate time
        if (lastStatus === "connected") {
          // Calculate connected time
          const connectedMs = change.timestamp - lastStatusTime

          // Add to the appropriate day
          if (dailyUptime[changeDay]) {
            dailyUptime[changeDay].connectedMs += connectedMs
          }
        }

        // Update last status
        lastStatus = change.status
        lastStatusTime = change.timestamp
      }

      // If last status is connected, add time until now
      if (lastStatus === "connected") {
        const now = new Date()
        const nowDay = now.toISOString().split("T")[0]

        if (dailyUptime[nowDay]) {
          dailyUptime[nowDay].connectedMs += now - lastStatusTime
        }
      }

      // Calculate uptime percentages
      for (const day in dailyUptime) {
        const { connectedMs, totalMs } = dailyUptime[day]
        dailyUptime[day].uptime = Number.parseFloat(((connectedMs / totalMs) * 100).toFixed(2))
      }

      uptimeData[scannerId] = dailyUptime
    }

    res.json({
      currentStatus,
      recentDisconnections,
      uptimeData,
    })
  } catch (err) {
    console.error("Error fetching dashboard data:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

module.exports = router

