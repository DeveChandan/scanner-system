const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const {
  Scanner1Model,
  Scanner2Model,
  Scanner3Model,
  Scanner4Model,
  Scanner5Model,
  Scanner6Model,
  Scanner7Model,
} = require("../models/scanner")

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

// Get production data for all scanners
router.get("/production-data", async (req, res) => {
  const { startDate, endDate } = req.query

  try {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 7))
    const end = endDate ? new Date(endDate) : new Date()

    // Ensure end date is set to the end of the day
    end.setHours(23, 59, 59, 999)

    const productionData = {}

    for (const [scannerId, model] of Object.entries(scannerModels)) {
      const aggregationPipeline = [
        {
          $match: {
            timestamp: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
              isValid: "$isValid",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            data: {
              $push: {
                isValid: "$_id.isValid",
                count: "$count",
              },
            },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]

      const scannerData = await model.aggregate(aggregationPipeline)

      productionData[scannerId] = scannerData.map((day) => ({
        date: day._id,
        validCount: day.data.find((d) => d.isValid)?.count || 0,
        invalidCount: day.data.find((d) => !d.isValid)?.count || 0,
      }))
    }

    res.json(productionData)
  } catch (err) {
    console.error("Error fetching production data:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get total production counts
router.get("/production-totals", async (req, res) => {
  try {
    const totals = {}

    for (const [scannerId, model] of Object.entries(scannerModels)) {
      const [result] = await model.aggregate([
        {
          $group: {
            _id: null,
            totalValid: {
              $sum: { $cond: [{ $eq: ["$isValid", true] }, 1, 0] },
            },
            totalInvalid: {
              $sum: { $cond: [{ $eq: ["$isValid", false] }, 1, 0] },
            },
          },
        },
      ])

      totals[scannerId] = {
        totalValid: result ? result.totalValid : 0,
        totalInvalid: result ? result.totalInvalid : 0,
      }
    }

    res.json(totals)
  } catch (err) {
    console.error("Error fetching production totals:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

module.exports = router

