/**
 * Utility functions for handling IP addresses
 */

/**
 * Extracts and formats client IP address from request
 * @param {Object} req - Express request object
 * @returns {String} Formatted client IP address
 */
exports.getFormattedClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = forwardedFor 
    ? forwardedFor.split(',')[0].trim() 
    : req.connection.remoteAddress || 
      req.socket.remoteAddress || 
      req.connection.socket?.remoteAddress || 
      'unknown';
             
  // Remove IPv6 prefix if present
  return ip.replace(/^::ffff:/, '');
};