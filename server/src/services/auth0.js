const { ManagementClient } = require('auth0');
require('dotenv').config();

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
  clientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
  audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
  scope: 'read:users read:roles read:role_members'
});

const getAuth0UserRoles = async (auth0Id) => {
  try {
    const roles = await auth0.users.getRoles({ id: auth0Id });
    return roles;
  } catch (error) {
    console.error('Error getting Auth0 user roles:', error);
    return [];
  }
};

module.exports = { auth0, getAuth0UserRoles };
