const express = require("express")
const router = express.Router()
const {
  Scanner1Model,
  Scanner2Model,
  Scanner3Model,
  Scanner4Model,
  Scanner5Model,
  Scanner6Model,
  Scanner7Model,
} = require("../models/scanner")
const ConnectionStatus = require("../models/connection-status")
const scannerManager = require("../scannerManager")

// Map scanner IDs to their models
const scannerModels = {
  scanner1: Scanner1Model,
  scanner2: Scanner2Model,
  scanner3: Scanner3Model,
  scanner4: Scanner4Model,
  scanner5: Scanner5Model,
  scanner6: Scanner6Model,
  scanner7: Scanner7Model,
}

// Get all scanners status
router.get("/scanners", (req, res) => {
  const scannerIds = Object.keys(scannerModels)
  res.json({ scanners: scannerIds })
})

// Get data from a specific scanner
router.get("/scanners/:scannerId", async (req, res) => {
  const { scannerId } = req.params
  const { limit = 100, skip = 0, startDate, endDate } = req.query

  const model = scannerModels[scannerId]

  if (!model) {
    return res.status(404).json({ error: `Scanner ${scannerId} not found` })
  }

  try {
    // Build query with optional date filtering
    const query = {}

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    const data = await model.find(query).sort({ timestamp: -1 }).skip(Number(skip)).limit(Number(limit))

    const total = await model.countDocuments(query)

    res.json({
      data,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip),
        hasMore: total > Number(skip) + Number(limit),
      },
    })
  } catch (err) {
    console.error(`Error fetching data for ${scannerId}:`, err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get latest data from all scanners
router.get("/latest", async (req, res) => {
  try {
    const results = {}

    // Get the latest record from each scanner
    for (const [scannerId, model] of Object.entries(scannerModels)) {
      const latestData = await model.findOne().sort({ timestamp: -1 })
      results[scannerId] = latestData
    }

    res.json(results)
  } catch (err) {
    console.error("Error fetching latest data:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get statistics for a specific scanner
router.get("/scanners/:scannerId/stats", async (req, res) => {
  const { scannerId } = req.params
  const { startDate, endDate } = req.query

  const model = scannerModels[scannerId]

  if (!model) {
    return res.status(404).json({ error: `Scanner ${scannerId} not found` })
  }

  try {
    // Build query with optional date filtering
    const query = {}

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    const totalCount = await model.countDocuments(query)
    const validCount = await model.countDocuments({ ...query, isValid: true })
    const invalidCount = await model.countDocuments({ ...query, isValid: false })

    // Get counts by product code
    const productCodeStats = await model.aggregate([
      { $match: { ...query, isValid: true } },
      { $group: { _id: "$parsedData.productCode", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    res.json({
      totalCount,
      validCount,
      invalidCount,
      errorRate: totalCount > 0 ? (invalidCount / totalCount) * 100 : 0,
      productCodeStats,
    })
  } catch (err) {
    console.error(`Error fetching stats for ${scannerId}:`, err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// NEW ENDPOINTS FOR CONNECTION STATUS

// Get current connection status for all scanners
router.get("/connection-status", (req, res) => {
  const status = scannerManager.getConnectionStatus()
  res.json(status)
})

// Get connection history for all scanners
router.get("/connection-history", async (req, res) => {
  const { limit = 100, skip = 0, startDate, endDate, scannerId } = req.query

  try {
    // Build query with optional filters
    const query = {}

    if (scannerId) {
      query.scannerId = scannerId
    }

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    const history = await ConnectionStatus.find(query).sort({ timestamp: -1 }).skip(Number(skip)).limit(Number(limit))

    const total = await ConnectionStatus.countDocuments(query)

    res.json({
      history,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip),
        hasMore: total > Number(skip) + Number(limit),
      },
    })
  } catch (err) {
    console.error("Error fetching connection history:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get connection history for a specific scanner
router.get("/scanners/:scannerId/connection-history", async (req, res) => {
  const { scannerId } = req.params
  const { limit = 100, skip = 0, startDate, endDate } = req.query

  try {
    // Build query with optional date filtering
    const query = { scannerId }

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    const history = await ConnectionStatus.find(query).sort({ timestamp: -1 }).skip(Number(skip)).limit(Number(limit))

    const total = await ConnectionStatus.countDocuments(query)

    res.json({
      history,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip),
        hasMore: total > Number(skip) + Number(limit),
      },
    })
  } catch (err) {
    console.error(`Error fetching connection history for ${scannerId}:`, err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get connection statistics
router.get("/connection-stats", async (req, res) => {
  const { startDate, endDate } = req.query

  try {
    // Build query with optional date filtering
    const query = {}

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    // Get disconnection counts by scanner
    const disconnectionsByScanner = await ConnectionStatus.aggregate([
      { $match: { ...query, status: "disconnected" } },
      { $group: { _id: "$scannerId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    // Get current status
    const currentStatus = scannerManager.getConnectionStatus()

    // Get uptime percentage for each scanner
    const scannerIds = Object.keys(scannerModels)
    const uptimeStats = {}

    for (const scannerId of scannerIds) {
      // Get total time range
      const timeQuery = { ...query, scannerId }
      const firstRecord = await ConnectionStatus.findOne({ scannerId }).sort({ timestamp: 1 }).limit(1)

      const lastRecord = await ConnectionStatus.findOne({ scannerId }).sort({ timestamp: -1 }).limit(1)

      if (firstRecord && lastRecord) {
        const totalTimeMs = lastRecord.timestamp - firstRecord.timestamp

        // Get all status changes
        const statusChanges = await ConnectionStatus.find(timeQuery).sort({ timestamp: 1 })

        // Calculate connected time
        let connectedTimeMs = 0
        let lastConnectedTime = null

        for (const record of statusChanges) {
          if (record.status === "connected") {
            lastConnectedTime = record.timestamp
          } else if (record.status === "disconnected" && lastConnectedTime) {
            connectedTimeMs += record.timestamp - lastConnectedTime
            lastConnectedTime = null
          }
        }

        // If last status was connected, add time until now
        if (lastConnectedTime && currentStatus[scannerId]?.status === "connected") {
          connectedTimeMs += new Date() - lastConnectedTime
        }

        // Calculate uptime percentage
        const uptimePercentage = totalTimeMs > 0 ? (connectedTimeMs / totalTimeMs) * 100 : 0

        uptimeStats[scannerId] = {
          totalTimeMs,
          connectedTimeMs,
          uptimePercentage: Number.parseFloat(uptimePercentage.toFixed(2)),
          firstRecordTime: firstRecord.timestamp,
          lastRecordTime: lastRecord.timestamp,
        }
      }
    }

    res.json({
      currentStatus,
      disconnectionsByScanner,
      uptimeStats,
    })
  } catch (err) {
    console.error("Error fetching connection statistics:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Force reconnect a scanner
router.post("/scanners/:scannerId/reconnect", async (req, res) => {
  const { scannerId } = req.params

  try {
    const success = await scannerManager.forceReconnect(scannerId)

    if (success) {
      res.json({ success: true, message: `Reconnection initiated for ${scannerId}` })
    } else {
      res.status(400).json({ success: false, message: `Could not reconnect ${scannerId}` })
    }
  } catch (err) {
    console.error(`Error reconnecting ${scannerId}:`, err)
    res.status(500).json({ error: "Internal server error" })
  }
})

module.exports = router

