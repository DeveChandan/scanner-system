require("dotenv").config()

// Scanner configuration
const scanners = [
  { id: "scanner1", ip: process.env.SCANNER1_IP, port: Number(process.env.SCANNER_PORT) },
  { id: "scanner2", ip: process.env.SCANNER2_IP, port: Number(process.env.SCANNER_PORT) },
  { id: "scanner3", ip: process.env.SCANNER3_IP || "10.255.17.95", port: Number(process.env.SCANNER_PORT) },
  { id: "scanner4", ip: process.env.SCANNER4_IP, port: Number(process.env.SCANNER_PORT) },
  { id: "scanner5", ip: process.env.SCANNER5_IP, port: Number(process.env.SCANNER_PORT) },
  { id: "scanner6", ip: process.env.SCANNER6_IP, port: Number(process.env.SCANNER_PORT) },
  { id: "scanner7", ip: process.env.SCANNER7_IP, port: Number(process.env.SCANNER_PORT) },
]

module.exports = {
  mongoURI: process.env.MONGODB_URI,
  scanners,
}

