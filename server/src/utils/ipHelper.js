/**
 * Gets a readable client IP address from a request object
 * @param {Object} req - Express request object
 * @return {String} Formatted IP address
 */
function getFormattedClientIp(req) {
  // Extract IP from request headers or connection
  const ip = req.headers['x-forwarded-for'] || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress || 
             (req.connection.socket ? req.connection.socket.remoteAddress : null) || 
             '0.0.0.0';
             
  // Format local IPs for better readability
  if (ip === '::1') {
    return 'Local (127.0.0.1)';
  }
  
  if (ip === '127.0.0.1') {
    return 'Local (127.0.0.1)';
  }
  
  // Handle IPv6 format that contains IPv4
  if (ip && ip.includes('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  
  return ip;
}

module.exports = { getFormattedClientIp };