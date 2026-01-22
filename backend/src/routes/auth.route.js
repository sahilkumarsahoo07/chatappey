import express from "express";
import { checkAuth, login, logout, logoutGlobal, signup, updateProfile, updateName, updateAbout, sendOtp, verifyOtp, resetPassword, blockUser, unblockUser, getBlockedUsers, signupOTP, verifySignup, changePassword, updatePrivacySettings, updateAppearanceSettings, toggleIncognito } from "../controllers/auth.controllers.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import multer from 'multer';
import passport from "passport";
import { generateToken } from "../lib/utils.js";
const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

router.post("/signup", signup);
router.post("/signup-otp", signupOTP);
router.post("/verify-signup", verifySignup);

router.post("/login", login);

router.post("/logout", protectRoute, logout);
router.post("/logout-global", protectRoute, logoutGlobal);

router.post("/send-otp", sendOtp);

router.post("/verify-otp", verifyOtp);

router.put("/reset-password", resetPassword);

router.put("/update-name", protectRoute, updateName);

router.put("/update-profile", protectRoute, upload.single('profilePic'), updateProfile);

router.put("/update-about", protectRoute, updateAbout);
router.put("/change-password", protectRoute, changePassword);
router.put("/update-privacy", protectRoute, updatePrivacySettings);
router.put("/update-appearance", protectRoute, updateAppearanceSettings);

router.get("/check", protectRoute, checkAuth);

// Update incognito
router.put("/update-incognito", protectRoute, toggleIncognito);

router.post("/block", protectRoute, blockUser);
router.post("/unblock", protectRoute, unblockUser);
router.get("/blocked-users", protectRoute, getBlockedUsers);

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    (req, res) => {
        // Successful authentication
        const token = generateToken(req.user._id, res, req.user.tokenVersion);
        // Redirect to frontend (adjust URL if needed)
        const frontendUrl = process.env.NODE_ENV === "production"
            ? "https://chatappey.netlify.app"
            : "http://localhost:5173";
        res.redirect(`${frontendUrl}?token=${token}`);
    }
);


export default router;