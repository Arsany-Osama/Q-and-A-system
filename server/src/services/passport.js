const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const { Strategy: Auth0Strategy } = require('passport-auth0');
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { getAuth0UserRoles } = require('./auth0');
const { getFormattedClientIp } = require('../utils/ipHelper'); // Import helper

const prisma = new PrismaClient();
const secretKey = process.env.JWT_SECRET;

// Configure JWT strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: secretKey
};

// Add JWT Strategy
passport.use('jwt', new JwtStrategy(jwtOptions, async (payload, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.id }
    });
    
    if (user) {
      return done(null, user);
    } else {
      return done(null, false);
    }
  } catch (error) {
    console.error('Error in JWT strategy:', error);
    return done(error, false);
  }
}));

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google OAuth profile received:', {
          id: profile.id,
          email: profile.emails?.[0]?.value,
          displayName: profile.displayName,
        });
        console.time('Google OAuth Strategy');

        // Check if user exists by Google ID
        let user = await prisma.user.findFirst({
          where: { googleId: profile.id },
        });

        // Get formatted client IP
        const ip = getFormattedClientIp(req);

        if (!user) {
          // Check by email
          user = await prisma.user.findUnique({
            where: { email: profile.emails[0].value },
          });

          if (!user) {
            // Create new user
            console.log('Creating new user for Google ID:', profile.id);
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email: profile.emails[0].value,
                username: profile.displayName || `user_${profile.id}`,
                role: 'USER',
                state: 'APPROVED',
                twoFAEnabled: false,
                lastLoginAt: new Date(), // Record initial login time
                lastLoginIp: ip // Use formatted IP
              },
            });
          } else {
            // Link Google ID to existing user
            console.log('Linking Google ID to existing user:', user.email);
            user = await prisma.user.update({
              where: { email: profile.emails[0].value },
              data: { 
                googleId: profile.id,
                lastLoginAt: new Date(), // Update login time
                lastLoginIp: ip // Use formatted IP
              },
            });
          }
        } else {
          // Update existing user's login information
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              lastLoginAt: new Date(),
              lastLoginIp: ip // Use formatted IP
            }
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          { 
            id: user.id, 
            username: user.username,
            role: user.role,
            state: user.state
          },
          secretKey,
          { expiresIn: '1h' }
        );

        console.log('User authenticated:', { id: user.id, username: user.username });
        console.timeEnd('Google OAuth Strategy');
        return done(null, { 
          user, 
          token,
          has2fa: user.twoFAEnabled || false
        });
      } catch (error) {
        console.error('Error in Google OAuth strategy:', error);
        return done(error, null);
      }
    }
  )
);

// Auth0 Strategy
passport.use(
  new Auth0Strategy(
    {
      domain: process.env.AUTH0_DOMAIN,
      clientID: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
      callbackURL: process.env.AUTH0_CALLBACK_URL,
      passReqToCallback: true,
      state: true,
      scope: 'openid email profile'
    },
    async (req, accessToken, refreshToken, extraParams, profile, done) => {
      try {
        // Check if user exists by Auth0 ID
        let user = await prisma.user.findFirst({
          where: { auth0Id: profile.id }
        });
        
        if (!user) {
          // Get email from profile, with fallback
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : 
                       profile._json.email || `${profile.id}@auth0user.com`;
          
          // Check if user exists by email
          user = await prisma.user.findUnique({
            where: { email }
          });

          if (!user) {
            // Get user roles from Auth0
            const rolesResponse = await getAuth0UserRoles(profile.id);
            console.log('Auth0 user roles:', rolesResponse);
            const roles = rolesResponse.data || [];
            const isAdmin = roles.some(role => role.name === 'Admin');
            
            // Generate username from available profile data
            let baseUsername = profile.displayName || 
                             profile.username || 
                             (email ? email.split('@')[0] : `user_${profile.id}`);

            // Function to generate random string
            const generateRandomSuffix = () => Math.random().toString(36).substring(2, 8);

            // Try to find a unique username
            let username = baseUsername;
            let attempts = 0;
            while (attempts < 3) {
              try {
                // Check if username exists
                const existingUser = await prisma.user.findUnique({
                  where: { username }
                });
                
                if (!existingUser) {
                  break; // Username is available
                }
                
                // Add random suffix and try again
                username = `${baseUsername}_${generateRandomSuffix()}`;
                attempts++;
              } catch (error) {
                console.error('Error checking username:', error);
                username = `${baseUsername}_${generateRandomSuffix()}`; // Fallback
                break;
              }
            }

            // Create new user
            user = await prisma.user.create({
              data: {
                auth0Id: profile.id,
                email: email,
                username: username,
                role: isAdmin ? 'ADMIN' : 'MODERATOR',
                state: isAdmin ? 'APPROVED' : 'PENDING',
                twoFAEnabled: false,
                lastLoginAt: new Date(), // Record initial login time
                lastLoginIp: ip // Use formatted IP
              }
            });
          } else {
            // Link Auth0 ID to existing user
            user = await prisma.user.update({
              where: { id: user.id },
              data: { 
                auth0Id: profile.id,
                role: 'MODERATOR',
                state: 'PENDING',
                lastLoginAt: new Date(), // Update login time
                lastLoginIp: ip // Use formatted IP
              }
            });
          }
        } else {
          // Update existing user's login information
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              lastLoginAt: new Date(),
              lastLoginIp: ip // Use formatted IP
            }
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          { 
            id: user.id, 
            username: user.username,
            role: user.role,
            state: user.state
          },
          secretKey,
          { expiresIn: '1h' }
        );

        return done(null, { user, token });
      } catch (error) {
        console.error('Error in Auth0 strategy:', error);
        return done(error, null);
      }
    }
  )
);

// Serialize user for session (if using sessions)
passport.serializeUser((data, done) => {
  done(null, data.user.id);
});

// Deserialize user from session (if using sessions)
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) }
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;