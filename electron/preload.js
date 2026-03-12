// Mark this as an Electron app before removing Electron traces
window.__ELECTRON__ = true;
delete window.process;
delete window.require;
delete window.module;
delete window.exports;
