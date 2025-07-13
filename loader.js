// Node.js v23+ compatibility loader for Webex SDK
// This script patches global objects before loading any modules

console.log('Setting up Node.js v23+ compatibility for Webex SDK...');

// Method 1: Patch global navigator with a proper descriptor
try {
  // Delete existing navigator if it exists and is not configurable
  try {
    delete global.navigator;
  } catch (e) {
    // Navigator might be non-configurable, that's okay
  }

  // Define a configurable navigator
  Object.defineProperty(global, 'navigator', {
    value: {
      userAgent: 'node.js',
      platform: process.platform,
      appName: 'node.js',
      appVersion: process.version,
      language: 'en-US',
      languages: ['en-US'],
      onLine: true,
      cookieEnabled: false,
      doNotTrack: '1'
    },
    writable: true,
    configurable: true,
    enumerable: true
  });

  // Ensure commonjsGlobal is configurable
  global.commonjsGlobal = global;
  
  console.log('✓ Navigator polyfill applied successfully');
} catch (error) {
  console.warn('⚠️  Warning setting up navigator polyfill:', error.message);
}

// Method 2: Override Object.defineProperty for the problematic library
const originalDefineProperty = Object.defineProperty;
Object.defineProperty = function(obj, prop, descriptor) {
  // If this is trying to define navigator on global/commonjsGlobal and it's failing
  if ((obj === global || obj === global.commonjsGlobal) && prop === 'navigator') {
    try {
      return originalDefineProperty.call(this, obj, prop, {
        ...descriptor,
        configurable: true,
        writable: true
      });
    } catch (e) {
      // If it still fails, just return the object (ignore the assignment)
      console.log('🔧 Bypassed navigator property assignment for compatibility');
      return obj;
    }
  }
  return originalDefineProperty.call(this, obj, prop, descriptor);
};

console.log('Loading main application...');

// Now load the main application
require('./app.js');
