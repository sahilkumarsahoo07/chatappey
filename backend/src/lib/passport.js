import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

// Only configure Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: "/api/auth/google/callback",
                proxy: true,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    let user = await User.findOne({ googleId: profile.id });

                    if (user) {
                        return done(null, user);
                    }

                    // If no user with googleId, check by email
                    user = await User.findOne({ email: profile.emails[0].value });

                    if (user) {
                        user.googleId = profile.id;
                        user.isVerified = true;
                        if (!user.profilePic) user.profilePic = profile.photos[0].value;
                        await user.save();
                        return done(null, user);
                    }

                    // Create new user
                    const newUser = new User({
                        fullName: profile.displayName,
                        email: profile.emails[0].value,
                        googleId: profile.id,
                        profilePic: profile.photos[0].value,
                        isVerified: true,
                    });

                    await newUser.save();
                    return done(null, newUser);
                } catch (error) {
                    return done(error, null);
                }
            }
        )
    );
} else {
    console.log("⚠️  Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing");
}

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport;
