const express = require("express")
const router = express.Router()
const path = require("path")

// Serve the production dashboard
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/production-dashboard.html"))
})

module.exports = router

