const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

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
    },
    async (accessToken, refreshToken, profile, done) => {
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
              },
            });
          } else {
            // Link Google ID to existing user
            console.log('Linking Google ID to existing user:', user.email);
            user = await prisma.user.update({
              where: { email: profile.emails[0].value },
              data: { googleId: profile.id },
            });
          }
        }

        // Generate JWT token
        const token = jwt.sign(
          { id: user.id, username: user.username },
          secretKey,
          { expiresIn: '1h' }
        );

        console.log('User authenticated:', { id: user.id, username: user.username });
        console.timeEnd('Google OAuth Strategy');
        return done(null, { user, token });
      } catch (error) {
        console.error('Error in Google OAuth strategy:', error);
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
