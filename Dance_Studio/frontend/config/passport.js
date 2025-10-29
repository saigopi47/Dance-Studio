const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });

        if (!user) {
          user = await User.create({
            firstName: profile.name.givenName || 'Google',
            lastName: profile.name.familyName || 'User',
            email,
            password: 'SOCIAL_LOGIN_DUMMY',
            phone: '0000000000',
            streetAddress1: 'Social Login',
            city: 'Social',
            region: 'Social',
            zipCode: '00000',
            country: 'Unknown',
            danceType: 'Unknown',
            startDate: new Date(),
            startTime: '00:00',
            isPaid: true,
          });
        }

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

module.exports = passport;
