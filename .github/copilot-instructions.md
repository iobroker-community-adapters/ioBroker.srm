# ioBroker Adapter Development with GitHub Copilot

**Version:** 1.0.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

## Project Context

You are working on the **ioBroker SRM (Synology Router Manager) adapter**. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. This adapter specifically connects ioBroker to Synology routers using the SRM (Synology Router Manager) API.

## Adapter-Specific Context

- **Adapter Name:** srm
- **Primary Function:** Connects to Synology routers to monitor and control router functionality
- **Target Devices:** Synology routers running SRM (Synology Router Manager)
- **Key Dependencies:** @iobroker/adapter-core for base functionality
- **API Integration:** Uses Synology SRM REST API for device communication
- **Configuration Requirements:** IP address, port (default 8001), username, password
- **Connection Type:** Local network HTTP/HTTPS API calls
- **Data Source:** Polling-based data collection

## Core Architecture

### Main Components

1. **main.js**: Main adapter class extending utils.Adapter
2. **lib/web_api.js**: SRM API client handling authentication and API calls
3. **lib/objects.js**: Object definitions for router states and device information
4. **lib/const.js**: Constants and configuration values
5. **admin/jsonConfig.json**: Admin UI configuration

### Data Structure

The adapter creates the following object hierarchy:
- `router.*`: Router status information (IPv4/IPv6, connection status)
- `devices.*`: Connected device information (all, mesh, online, ethernet, wifi)
- `info.connection`: Connection status indicator

## Development Guidelines

### ioBroker Adapter Patterns

1. **Adapter Lifecycle**
   - Initialize in `constructor()`: Set up event handlers, import libraries
   - Configure in `onReady()`: Create states, establish connections, start polling
   - Clean up in `onUnload()`: Stop timers, close connections, cleanup resources

2. **State Management**
   - Use `setObjectNotExistsAsync()` for creating states
   - Use `setState()` for updating values with proper acknowledgment flags
   - Follow ioBroker naming conventions for state IDs

3. **Logging Practices**
   - Use appropriate log levels: `error`, `warn`, `info`, `debug`
   - Include context in log messages
   - Avoid logging sensitive information (passwords, tokens)

### API Integration Patterns

1. **Authentication Handling**
   - Store credentials securely in adapter configuration
   - Implement token refresh mechanisms
   - Handle authentication failures gracefully

2. **Error Handling**
   - Implement retry logic for network failures
   - Set connection state to false on persistent errors
   - Log errors with sufficient context for debugging

3. **Data Processing**
   - Validate API responses before processing
   - Handle different API versions if applicable
   - Parse and normalize device information consistently

### Code Quality Standards

1. **ESLint Configuration**
   - Follow `@iobroker/eslint-config` rules
   - Add JSDoc comments for all functions and classes
   - Maintain consistent code formatting

2. **Testing**
   - Write unit tests for API client functionality
   - Test error scenarios and edge cases
   - Ensure tests pass before committing changes

3. **Type Safety**
   - Use TypeScript definitions where available
   - Validate input parameters and API responses
   - Handle undefined/null values appropriately

## Synology Router Manager (SRM) Specifics

### API Characteristics
- **Base URL**: `http(s)://[router-ip]:[port]/webapi/`
- **Authentication**: Session-based with login/logout endpoints
- **API Version**: Supports multiple API versions, adapter should handle version detection
- **Rate Limiting**: Respect API rate limits to avoid blocking

### Device Information Structure
Each connected device typically includes:
- `connection`: Connection type (Ethernet, WiFi)
- `dev_type`: Device category (Computer, Mobile, etc.)
- `hostname`: Device hostname
- `ip_addr`: IPv4 address
- `ip6_addr`: IPv6 address (if available)
- `mac`: MAC address
- `is_online`: Connection status
- Various QoS and configuration flags

### Configuration Settings
- WiFi settings management (some settings can be modified)
- Device bandwidth control
- Access control and device banning
- Network monitoring and statistics

## Common Development Tasks

### Adding New API Endpoints
1. Update `lib/web_api.js` with new API methods
2. Define corresponding objects in `lib/objects.js`
3. Implement data fetching in main adapter loop
4. Add error handling and logging

### Extending Device Information
1. Modify device parsing logic in main.js
2. Update object definitions with new properties
3. Ensure backward compatibility with existing configurations
4. Test with different router models if possible

### Configuration Changes
1. Update `admin/jsonConfig.json` for UI changes
2. Handle new configuration parameters in adapter startup
3. Implement proper validation and defaults
4. Update documentation and translations as needed

## Performance Considerations

1. **Polling Intervals**: Balance data freshness with API load
2. **Batch Operations**: Group API calls where possible
3. **Memory Management**: Clean up large data structures properly
4. **Connection Pooling**: Reuse HTTP connections when feasible

## Security Considerations

1. **Credential Storage**: Use encrypted native storage for passwords
2. **API Security**: Always use HTTPS when available
3. **Input Validation**: Sanitize all user inputs and API responses
4. **Error Messages**: Avoid exposing sensitive information in logs

## When Contributing Code

1. **Follow Existing Patterns**: Maintain consistency with current code structure
2. **Test Thoroughly**: Ensure changes work with actual Synology hardware
3. **Update Documentation**: Keep README and configuration docs current
4. **Backward Compatibility**: Avoid breaking changes to existing configurations
5. **Internationalization**: Update translation files when adding UI text

## Debugging and Troubleshooting

### Common Issues
1. **Authentication Failures**: Check credentials and 2FA settings
2. **Network Connectivity**: Verify router IP and port accessibility
3. **API Version Mismatches**: Implement version detection and fallbacks
4. **Device Detection Issues**: Handle different device types and configurations

### Debugging Tools
1. Use `debug` log level for detailed API communication
2. Monitor network traffic to understand API behavior
3. Test with different router firmware versions
4. Use ioBroker's built-in debugging tools

This adapter aims to provide reliable connectivity to Synology routers while maintaining the high standards expected of ioBroker adapters.