import express from "express";
import { checkAuth, login, logout, signup, updateProfile, updateName, updateAbout,sendOtp,verifyOtp,resetPassword,blockUser,unblockUser,getBlockedUsers } from "../controllers/auth.controllers.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import multer from 'multer';
const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

router.post("/signup", signup);

router.post("/login", login);

router.post("/logout", protectRoute, logout);

router.post("/send-otp", sendOtp);

router.post("/verify-otp", verifyOtp);

router.put("/reset-password", resetPassword);

router.put("/update-name", protectRoute, updateName);

router.put("/update-profile", protectRoute, upload.single('profilePic'), updateProfile);

router.put("/update-about", protectRoute, updateAbout);

router.get("/check", protectRoute, checkAuth);

router.post("/block", protectRoute, blockUser);
router.post("/unblock", protectRoute, unblockUser);
router.get("/blocked-users", protectRoute, getBlockedUsers);


export default router;