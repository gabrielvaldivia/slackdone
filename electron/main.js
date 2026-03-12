const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");

let mainWindow;
let nextServer;
let activePort;
const DEV_PORT = 3000;
const PROD_PORT = 3033;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket
      .setTimeout(300)
      .on("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .on("timeout", () => {
        socket.destroy();
        resolve(false);
      })
      .on("error", () => resolve(false))
      .connect(port, "localhost");
  });
}

function findOpenPort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      server.close(() => resolve(startPort));
    });
    server.on("error", () => resolve(findOpenPort(startPort + 1)));
  });
}

function waitForServer(port, retries = 60) {
  return new Promise((resolve, reject) => {
    const check = (attempt) => {
      const socket = new net.Socket();
      socket
        .setTimeout(500)
        .on("connect", () => {
          socket.destroy();
          resolve();
        })
        .on("timeout", () => {
          socket.destroy();
          if (attempt < retries) setTimeout(() => check(attempt + 1), 500);
          else reject(new Error("Server did not start"));
        })
        .on("error", () => {
          if (attempt < retries) setTimeout(() => check(attempt + 1), 500);
          else reject(new Error("Server did not start"));
        })
        .connect(port, "localhost");
    };
    check(0);
  });
}

function startNextServer(port) {
  const isProd = app.isPackaged;
  const appPath = isProd
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..");

  const nextBin = path.join(appPath, "node_modules", ".bin", "next");

  if (isProd) {
    nextServer = spawn(nextBin, ["start", "-p", String(port)], {
      cwd: appPath,
      env: { ...process.env, PORT: String(port) },
    });
  } else {
    nextServer = spawn(nextBin, ["dev", "-p", String(port)], {
      cwd: appPath,
      env: { ...process.env, PORT: String(port) },
    });
  }

  nextServer.stdout?.on("data", (d) => console.log(`[next] ${d}`));
  nextServer.stderr?.on("data", (d) => console.error(`[next] ${d}`));
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Use a standard Chrome user agent so Slack OAuth works in-window
  const chromeUA = mainWindow.webContents
    .getUserAgent()
    .replace(/\s*Electron\/\S+/, "")
    .replace(/\s*slackdone\/\S+/i, "");
  mainWindow.webContents.setUserAgent(chromeUA);

  mainWindow.loadURL(`http://localhost:${port}`);

  // Rewrite any https://localhost navigation to http:// since our server is HTTP
  const rewriteHttps = (event, url) => {
    if (url.startsWith("https://localhost")) {
      event.preventDefault();
      mainWindow.loadURL(url.replace("https://", "http://"));
    }
  };
  mainWindow.webContents.on("will-navigate", rewriteHttps);
  mainWindow.webContents.on("will-redirect", rewriteHttps);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", async () => {
  // In dev, try to connect to an existing Next.js dev server first
  if (!app.isPackaged) {
    const devRunning = await isPortInUse(DEV_PORT);
    if (devRunning) {
      activePort = DEV_PORT;
      createWindow(activePort);
      return;
    }
  }

  const port = await findOpenPort(app.isPackaged ? PROD_PORT : DEV_PORT);
  activePort = port;
  startNextServer(port);
  await waitForServer(port);
  createWindow(port);
});

app.on("window-all-closed", () => {
  if (nextServer) nextServer.kill();
  app.quit();
});

app.on("before-quit", () => {
  if (nextServer) nextServer.kill();
});

app.on("activate", () => {
  if (mainWindow === null && activePort) {
    createWindow(activePort);
  }
});
