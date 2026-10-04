// Metro config for the hospice mobile app.
// Maps TypeScript ESM-style ".js" import specifiers to their ".ts" source files
// so workspace packages (e.g. @repo/types via the "react-native" export
// condition) resolve without a prebuilt dist/ folder.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (typeof moduleName === 'string' && moduleName.endsWith('.js')) {
    const tsModule = moduleName.slice(0, -3) + '.ts';
    try {
      return context.resolveRequest
        ? context.resolveRequest(context, tsModule, platform)
        : defaultResolveRequest(context, tsModule, platform);
    } catch {
      // Fall through to default resolution below.
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
