const net = require("net");
const config = require("./config");
const {
  Scanner1Model,
  Scanner2Model,
  Scanner3Model,
  Scanner4Model,
  Scanner5Model,
  Scanner6Model,
  Scanner7Model,
} = require("./models/scanner");
const ConnectionStatus = require("./models/connection-status");

// Map scanner IDs to their models
const scannerModels = {
  scanner1: Scanner1Model,
  scanner2: Scanner2Model,
  scanner3: Scanner3Model,
  scanner4: Scanner4Model,
  scanner5: Scanner5Model,
  scanner6: Scanner6Model,
  scanner7: Scanner7Model,
};

// Store active client connections
const activeClients = {};
// Track connection status
const connectionStatus = {};

// Record connection status change in MongoDB
async function recordConnectionStatus(
  scannerId,
  status,
  ipAddress,
  port,
  errorMessage = null,
  reconnectAttempts = 0
) {
  try {
    const statusRecord = new ConnectionStatus({
      scannerId,
      status,
      ipAddress,
      port,
      errorMessage,
      reconnectAttempts,
    });

    await statusRecord.save();

    // Update in-memory status
    connectionStatus[scannerId] = {
      status,
      lastStatusChange: new Date(),
      ipAddress,
      port,
      errorMessage,
      reconnectAttempts,
    };

    console.log(`Scanner ${scannerId} ${status} status recorded`);
  } catch (err) {
    console.error(`Error recording connection status for ${scannerId}:`, err);
  }
}

// Parse the received data
function parseData(rawData) {
  const parts = rawData.split(",");
  if (parts.length !== 5) {
    return {
      isValid: false,
      errorMessage: "Invalid data format: incorrect number of fields",
      parsedData: null,
    };
  }

  const [type, status, productCode, serialNumber, counter] = parts;
  const parsedCounter = Number.parseInt(counter, 10);

  if (isNaN(parsedCounter)) {
    return {
      isValid: false,
      errorMessage: "Invalid data format: counter is not a number",
      parsedData: null,
    };
  }

  return {
    isValid: true,
    errorMessage: null,
    parsedData: {
      type,
      status,
      productCode,
      serialNumber,
      counter: parsedCounter,
    },
  };
}

// Function to create a TCP client for a scanner
function createScannerClient(scanner) {
  const client = new net.Socket();
  const model = scannerModels[scanner.id];
  const scannerPort = 30000; // Fixed port for all scanners
  let reconnectAttempts = 0;
  let isConnected = false;

  if (!model) {
    console.error(`No model defined for scanner ${scanner.id}`);
    return null;
  }

  function connectToScanner() {
    if (!scanner.ip) {
      console.error(`IP address not configured for ${scanner.id}`);
      recordConnectionStatus(
        scanner.id,
        "disconnected",
        scanner.ip,
        scannerPort,
        "IP address not configured",
        reconnectAttempts
      );
      setTimeout(connectToScanner, 60000); // Try again in a minute
      return;
    }

    client.connect(scannerPort, scanner.ip, () => {
      console.log(`Connected to industrial scanner ${scanner.id} at ${scanner.ip}:${scannerPort}`);
      isConnected = true;
      reconnectAttempts = 0;

      // Record connection status
      recordConnectionStatus(scanner.id, "connected", scanner.ip, scannerPort);
    });
  }

  // Handle incoming data from industrial scanner
  client.on("data", (data) => {
    const rawData = data.toString().trim();
    console.log(`Received data from ${scanner.id}:`, rawData);

    const { isValid, errorMessage, parsedData } = parseData(rawData);

    // Save received data to MongoDB
    const newData = new model({
      rawData: rawData,
      parsedData: parsedData,
      isValid: isValid,
      errorMessage: errorMessage,
    });

    newData
      .save()
      .then(() => {
        if (isValid) {
          console.log(`Valid data saved to MongoDB from ${scanner.id}:`, parsedData);
        } else {
          console.log(`Invalid data saved to MongoDB from ${scanner.id}. Error: ${errorMessage}`);
        }
      })
      .catch((err) => console.error(`Error saving data from ${scanner.id}:`, err));
  });

  // Handle connection close
  client.on("close", () => {
    if (isConnected) {
      console.log(`Connection closed for ${scanner.id}. Attempting to reconnect...`);
      isConnected = false;
      reconnectAttempts++;

      // Record disconnection
      recordConnectionStatus(
        scanner.id,
        "disconnected",
        scanner.ip,
        scannerPort,
        "Connection closed unexpectedly",
        reconnectAttempts
      );
    }

    // Exponential backoff for reconnection attempts (max 5 minutes)
    const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts - 1), 300000);
    console.log(`Will attempt to reconnect ${scanner.id} in ${delay / 1000} seconds (attempt ${reconnectAttempts})`);

    setTimeout(connectToScanner, delay);
  });

  // Handle errors
  client.on("error", (err) => {
    console.error(`Connection error for ${scanner.id}:`, err);

    if (isConnected) {
      isConnected = false;

      // Record error
      recordConnectionStatus(scanner.id, "disconnected", scanner.ip, scannerPort, err.message, reconnectAttempts);
    }
  });

  // Initial connection
  connectToScanner();

  return client;
}

// Get current connection status for all scanners
function getConnectionStatus() {
  return connectionStatus;
}

// Initialize all scanner connections
function initializeScanners() {
  config.scanners.forEach((scanner) => {
    const client = createScannerClient(scanner);
    if (client) {
      activeClients[scanner.id] = client;

      // Initialize status as disconnected using the fixed port
      connectionStatus[scanner.id] = {
        status: "disconnected",
        lastStatusChange: new Date(),
        ipAddress: scanner.ip,
        port: "30000",
        errorMessage: null,
        reconnectAttempts: 0,
      };
    }
  });
}

// Disconnect all scanner connections
function disconnectAll() {
  Object.entries(activeClients).forEach(([scannerId, client]) => {
    if (client && client.destroy) {
      recordConnectionStatus(
        scannerId,
        "disconnected",
        connectionStatus[scannerId]?.ipAddress,
        connectionStatus[scannerId]?.port,
        "Application shutdown"
      );
      client.destroy();
    }
  });
}

// Force reconnect a specific scanner
async function forceReconnect(scannerId) {
  if (activeClients[scannerId] && activeClients[scannerId].destroy) {
    console.log(`Force reconnecting scanner ${scannerId}`);
    activeClients[scannerId].destroy();

    // Find the scanner config
    const scanner = config.scanners.find((s) => s.id === scannerId);
    if (scanner) {
      // Wait a bit before reconnecting
      await new Promise((resolve) => setTimeout(resolve, 1000));
      activeClients[scannerId] = createScannerClient(scanner);
      return true;
    }
  }
  return false;
}

module.exports = {
  initializeScanners,
  disconnectAll,
  activeClients,
  getConnectionStatus,
  forceReconnect,
};
