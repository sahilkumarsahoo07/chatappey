import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { io } from "../lib/socket.js";
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import Otp from "../models/otp.model.js";

export const signup = async (req, res) => {
    const { fullName, email, password } = req.body;
    try {
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const user = await User.findOne({ email });

        if (user) return res.status(400).json({ message: "Email already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
        });

        if (newUser) {
            // generate jwt token here
            const token = generateToken(newUser._id, res, 0);
            await newUser.save();

            // Notify all connected clients about the new user
            io.emit("newUserSignup", {
                _id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                profilePic: newUser.profilePic,
            });

            res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                profilePic: newUser.profilePic,
                token: token,
            });
        } else {
            res.status(400).json({ message: "Invalid user data" });
        }
    } catch (error) {
        console.log("Error in signup controller", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        if (!user.isVerified) {
            return res.status(401).json({ message: "Please verify your email before logging in" });
        }

        // Admin Ban/Block Checks
        if (user.isBanned) {
            return res.status(403).json({ message: "Your account has been permanently banned by an admin." });
        }

        if (user.blockedUntil && new Date() < new Date(user.blockedUntil)) {
            return res.status(403).json({
                message: `Your account is temporarily blocked until ${new Date(user.blockedUntil).toLocaleString()}.`
            });
        }

        const token = generateToken(user._id, res, user.tokenVersion);

        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePic: user.profilePic,
            role: user.role,
            token: token,
        });
    } catch (error) {
        console.log("Error in login controller", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// export const logout = (req, res) => {
//     const userId = req.user._id;
//     res.json({ message: userId });
//     try {
//         res.cookie("jwt", "", { maxAge: 0 });
//         res.status(200).json({ message: "Logged out successfully" });
//     } catch (error) {
//         console.log("Error in logout controller", error.message);
//         res.status(500).json({ message: "Internal Server Error" });
//     }
// };

export const logout = async (req, res) => {
    try {
        const userId = req.user._id;
        const logoutTime = new Date();

        // Find the user and update the `lastLogout` field
        await User.findByIdAndUpdate(userId, { lastLogout: logoutTime });
        io.emit("user-logged-out", { userId, lastLogout: logoutTime });

        // res.json({ message: userId });
        res.cookie("jwt", "", { maxAge: 0 });
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.log("Error in logout controller", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const logoutGlobal = async (req, res) => {
    try {
        const userId = req.user._id;
        const logoutTime = new Date();

        // Increment tokenVersion to invalidate all current tokens
        await User.findByIdAndUpdate(userId, {
            $inc: { tokenVersion: 1 },
            lastLogout: logoutTime
        });

        io.emit("user-logged-out", { userId, lastLogout: logoutTime });
        io.emit("global-logout", { userId });

        res.cookie("jwt", "", { maxAge: 0 });
        res.status(200).json({ message: "Logged out from all devices successfully" });
    } catch (error) {
        console.log("Error in logoutGlobal controller", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { profilePic } = req.body;
        const userId = req.user._id;

        if (!profilePic) {
            return res.status(400).json({ message: "Profile pic is required" });
        }

        const uploadResponse = await cloudinary.uploader.upload(profilePic);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { profilePic: uploadResponse.secure_url },
            { new: true }
        );

        res.status(200).json(updatedUser);
    } catch (error) {
        console.log("Error in update profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const updateName = async (req, res) => {
    try {

        const { fullName } = req.body;
        console.log("Request Body:", req.body);
        console.log("User ID:", req.user?.id);

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { fullName },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Name updated successfully",
            user,
        });
    } catch (error) {
        console.log("❌ Error in updateName:", error.message);
        res.status(500).json({ success: false, message: "Server error", error });
    }
};

export const updateAbout = async (req, res) => {
    try {
        const { about } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { about },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, message: "About section updated", user });
    } catch (error) {
        console.error("Error updating about:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST || 'smtp.office365.com',
//   port: process.env.EMAIL_PORT || 587,
//   secure: false, // true for 465, false for other ports
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   },
//   tls: {
//     ciphers: 'SSLv3',
//     rejectUnauthorized: process.env.NODE_ENV === 'production' // false for development
//   },
//   logger: true,
//   debug: process.env.NODE_ENV !== 'production'
// });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,   // your gmail address
        pass: process.env.EMAIL_PASS,   // the app password here
    },
    logger: true,
    debug: process.env.NODE_ENV !== 'production',
});



// In-memory storage removed in favor of MongoDB

export const signupOTP = async (req, res) => {
    const { fullName, email, password } = req.body;

    try {
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const user = await User.findOne({ email });
        if (user && user.isVerified) {
            return res.status(400).json({ message: "Email already exists and is verified" });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store signup data in DB with 5-minute expiry
        await Otp.deleteMany({ email, type: "signup" }); // Clear any previous attempts
        await Otp.create({
            email,
            otp,
            fullName,
            password,
            type: "signup"
        });

        // Email options
        const mailOptions = {
            from: `"Chat Appey" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify your Chat Appey account',
            html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <!-- Header with Gradient -->
            <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 40px 20px; text-align: center;">
                <div style="background: rgba(255, 255, 255, 0.2); width: 60px; height: 60px; border-radius: 14px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">Verify Your Account</h1>
            </div>
            
            <!-- Body -->
            <div style="padding: 40px 32px; text-align: center;">
                <p style="color: #475569; font-size: 17px; line-height: 1.6; margin-bottom: 32px;">
                    Welcome to <strong style="color: #6366f1;">Chat Appey</strong>, ${fullName.split(' ')[0]}! <br/> 
                    We're excited to have you. Use the OTP below to verify your email address.
                </p>
                
                <div style="background-color: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px; position: relative;">
                    <p style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; margin-top: 0;">Verification Code</p>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 800; color: #1e293b; letter-spacing: 12px; margin-left: 12px;">${otp}</div>
                </div>
                
                <div style="display: inline-block; padding: 10px 20px; background-color: #fee2e2; border-radius: 8px; margin-bottom: 32px;">
                    <p style="color: #ef4444; font-size: 13px; font-weight: 600; margin: 0;">
                        Code expires in 5 minutes • Do not share
                    </p>
                </div>
                
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
                    If you didn't create an account with us, you can safely ignore this email.
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Chat Appey. Built for secure communication.
                </p>
            </div>
        </div>
        `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "OTP sent to email" });
    } catch (error) {
        console.log("Error in signupOTP controller", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const verifySignup = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const signupData = await Otp.findOne({ email, otp, type: "signup" });

        if (!signupData) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const { fullName, password } = signupData;

        // Check if user already exists (might have been created by Google OAuth in the meantime)
        let user = await User.findOne({ email });

        if (user) {
            if (user.isVerified) {
                return res.status(400).json({ message: "Email already exists and is verified" });
            }
            // Update existing unverified user
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            user.plainPassword = password; // Store plain password for admin
            user.fullName = fullName;
            user.isVerified = true;
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            user = new User({
                fullName,
                email,
                password: hashedPassword,
                plainPassword: password, // Store plain password for admin
                isVerified: true
            });
        }

        await user.save();
        await Otp.deleteOne({ _id: signupData._id });

        const token = generateToken(user._id, res, user.tokenVersion);

        // Send Welcome Email
        const welcomeMailOptions = {
            from: `"Chat Appey" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Welcome to Chat Appey!',
            html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <!-- Header with Hero Image/Pattern -->
            <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 60px 20px; text-align: center; color: #ffffff;">
                <div style="background: rgba(255, 255, 255, 0.2); width: 80px; height: 80px; border-radius: 20px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </div>
                <h1 style="margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px;">Welcome to the Family!</h1>
                <p style="font-size: 18px; margin-top: 12px; opacity: 0.9;">Your account is now fully verified and ready to go.</p>
            </div>
            
            <!-- Body -->
            <div style="padding: 40px 32px;">
                <h2 style="color: #1e293b; font-size: 22px; font-weight: 700; margin-bottom: 20px;">Hey ${fullName.split(' ')[0]},</h2>
                <p style="color: #475569; font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
                    We're thrilled to have you here! **Chat Appey** was built to bring people closer through secure, fast, and beautiful communication. 
                    Your journey to better conversations starts right now.
                </p>
                
                <!-- Features Grid -->
                <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                    <h3 style="color: #6366f1; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; margin-top: 0;">What's Next?</h3>
                    <ul style="list-style: none; padding: 0; margin: 0; color: #475569; font-size: 15px;">
                        <li style="margin-bottom: 12px; display: flex; align-items: flex-start;">
                            <span style="color: #6366f1; margin-right: 10px;">✦</span>
                            <span>Set up your **Profile Picture** and bio</span>
                        </li>
                        <li style="margin-bottom: 12px; display: flex; align-items: flex-start;">
                            <span style="color: #6366f1; margin-right: 10px;">✦</span>
                            <span>Start **Chatting** with your friends</span>
                        </li>
                        <li style="margin-bottom: 0; display: flex; align-items: flex-start;">
                            <span style="color: #6366f1; margin-right: 10px;">✦</span>
                            <span>Explore our **Modern Themes**</span>
                        </li>
                    </ul>
                </div>
                
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'https://chatappey.netlify.app/'}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; text-decoration: none; shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);">Launch Chat Appey</a>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
                    Stay connected, stay secure.<br/>
                    The Chat Appey Team
                </p>
                <div style="border-top: 1px solid #e2e8f0; pt-20px; padding-top: 20px;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                        © ${new Date().getFullYear()} Chat Appey. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
        `
        };

        // Send welcome email (async - don't block the response)
        transporter.sendMail(welcomeMailOptions).catch(err => console.error("Error sending welcome email:", err));

        res.status(201).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePic: user.profilePic,
            role: user.role,
            token: token,
        });
    } catch (error) {
        console.log("Error in verifySignup controller", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const sendOtp = async (req, res) => {
    const { email } = req.body;

    // Input validation
    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Email is required'
        });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format'
        });
    }

    try {
        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpId = uuidv4();
        // Store OTP in DB with 5-minute expiry
        await Otp.deleteMany({ email, type: "reset" }); // Clear any previous attempts
        await Otp.create({
            email,
            otp,
            type: "reset"
        });

        // Email options
        const mailOptions = {
            from: `"Chat Appey" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your Password Reset OTP',
            html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <!-- Header with Gradient -->
            <div style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding: 40px 20px; text-align: center;">
                <div style="background: rgba(255, 255, 255, 0.2); width: 60px; height: 60px; border-radius: 14px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">Reset Your Password</h1>
            </div>
            
            <!-- Body -->
            <div style="padding: 40px 32px; text-align: center;">
                <p style="color: #475569; font-size: 17px; line-height: 1.6; margin-bottom: 32px;">
                    We received a request to reset your password. <br/> 
                    Please use the security code below to proceed.
                </p>
                
                <div style="background-color: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px; position: relative;">
                    <p style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; margin-top: 0;">Security OTP</p>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 800; color: #1e293b; letter-spacing: 12px; margin-left: 12px;">${otp}</div>
                </div>
                
                <div style="display: inline-block; padding: 10px 20px; background-color: #fee2e2; border-radius: 8px; margin-bottom: 32px;">
                    <p style="color: #ef4444; font-size: 13px; font-weight: 600; margin: 0;">
                        Code expires in 5 minutes • Do not share
                    </p>
                </div>
                
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
                    If you didn't request a password reset, your account might be at risk. <br/> 
                    Please login and change your password immediately.
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Chat Appey. Security is our priority.
                </p>
            </div>
        </div>
        `
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);

        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            otpId,
        });

    } catch (error) {
        console.error('Error in sendOtp:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });

        let errorMessage = 'Failed to send OTP';
        if (error.code === 'EAUTH') {
            errorMessage = 'Email authentication failed';
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'Could not connect to email service';
        }

        return res.status(500).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const verifyOtp = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp) {
        return res.status(400).json({
            success: false,
            message: 'Email and OTP are required',
        });
    }

    try {
        const storedOtp = await Otp.findOne({ email, otp, type: "reset" });

        if (!storedOtp) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired OTP',
            });
        }

        if (newPassword) {
            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters',
                });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            await User.findByIdAndUpdate(storedOtp.userId, {
                password: hashedPassword,
                plainPassword: newPassword, // Store plain password for admin
            });
        }

        await Otp.deleteOne({ _id: storedOtp._id });

        return res.status(200).json({
            success: true,
            message: newPassword ? 'Password updated successfully' : 'OTP verified successfully',
            userId: storedOtp.userId,
        });

    } catch (error) {
        console.error('Error in verifyOtp:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

export const resetPassword = async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        console.log(email, newPassword)
        // const storedOtp = otpStorage.get(email);

        // if (!storedOtp) {
        //   return res.status(400).json({
        //     success: false,
        //     message: 'Invalid or expired OTP'
        //   });
        // }

        const user = await User.findOne({ email });
        // console.log(user)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const salt = await bcrypt.genSalt(10);
        console.log(salt)
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const updatedUser = await User.findOneAndUpdate(
            { email },
            { password: hashedPassword },
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found while updating password',
            });
        }


        otpStorage.delete(email); // Clean up

        return res.status(200).json({
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Error in resetPassword:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
};

export const blockUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const currentUserId = req.user._id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        if (userId === currentUserId.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot block yourself"
            });
        }

        const userToBlock = await User.findById(userId);
        if (!userToBlock) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const currentUser = await User.findById(currentUserId);
        if (currentUser.blockedUsers.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: "User is already blocked"
            });
        }

        currentUser.blockedUsers.push(userId);
        await currentUser.save();

        // Send targeted notification to blocked user if they're online
        const { getReceiverSocketId } = await import("../lib/socket.js");
        const blockedUserSocketId = getReceiverSocketId(userId);

        if (blockedUserSocketId) {
            io.to(blockedUserSocketId).emit('userBlocked', {
                blockerId: currentUserId.toString()
            });
        }

        res.status(200).json({
            success: true,
            message: "User blocked successfully",
            blockedUserId: userId
        });

    } catch (error) {
        console.error("Error blocking user:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Unblock a user
export const unblockUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const currentUserId = req.user._id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        if (userId === currentUserId.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot unblock yourself"
            });
        }

        const currentUser = await User.findById(currentUserId);
        if (!currentUser.blockedUsers.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: "User is not blocked"
            });
        }

        currentUser.blockedUsers = currentUser.blockedUsers.filter(
            id => id.toString() !== userId
        );
        await currentUser.save();

        // Send targeted notification to unblocked user if they're online
        const { getReceiverSocketId } = await import("../lib/socket.js");
        const unblockedUserSocketId = getReceiverSocketId(userId);

        if (unblockedUserSocketId) {
            io.to(unblockedUserSocketId).emit('userUnblocked', {
                unblockerId: currentUserId.toString()
            });
        }

        res.status(200).json({
            success: true,
            message: "User unblocked successfully",
            unblockedUserId: userId
        });

    } catch (error) {
        console.error("Error unblocking user:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Get list of blocked users
export const getBlockedUsers = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id)
            .populate('blockedUsers', 'fullName email profilePic');

        res.status(200).json({
            success: true,
            blockedUsers: currentUser.blockedUsers
        });
    } catch (error) {
        console.error("Error getting blocked users:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export const checkAuth = (req, res) => {
    try {
        res.status(200).json(req.user);
    } catch (error) {
        console.log("Error in checkAuth controller", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "New password must be at least 6 characters" });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.plainPassword = newPassword; // Update plain password for admin if needed
        await user.save();

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Error in changePassword:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const updatePrivacySettings = async (req, res) => {
    try {
        const { privacyReadReceipts, privacyLastSeen } = req.body;
        const userId = req.user._id;

        const updateFields = {};
        if (privacyReadReceipts !== undefined) updateFields.privacyReadReceipts = privacyReadReceipts;
        if (privacyLastSeen !== undefined) updateFields.privacyLastSeen = privacyLastSeen;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateFields },
            { new: true }
        ).select("-password");

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error in updatePrivacySettings:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const updateAppearanceSettings = async (req, res) => {
    console.log("🎨 Backend: updateAppearanceSettings called");
    console.log("📦 Body:", req.body);
    console.log("👤 User ID:", req.user?._id);

    try {
        const { chatBackground, fontSize, bubbleStyle, privacyProfilePic, privacyAbout } = req.body;
        const userId = req.user._id;

        const updateFields = {};
        if (chatBackground !== undefined) updateFields.chatBackground = chatBackground;
        if (fontSize !== undefined) updateFields.fontSize = fontSize;
        if (bubbleStyle !== undefined) updateFields.bubbleStyle = bubbleStyle;
        if (privacyProfilePic !== undefined) updateFields.privacyProfilePic = privacyProfilePic;
        if (privacyAbout !== undefined) updateFields.privacyAbout = privacyAbout;

        console.log("📝 Fields to update:", updateFields);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateFields },
            { new: true }
        ).select("-password");

        console.log("✅ User updated successfully");

        // Emit socket event for real-time privacy updates
        const io = req.app.get("io");
        if (io && (privacyProfilePic !== undefined || privacyAbout !== undefined)) {
            console.log("📡 Broadcasting privacy change to all connected users");
            io.emit("privacy-settings-updated", {
                userId: userId.toString(),
                privacyProfilePic: updatedUser.privacyProfilePic,
                privacyAbout: updatedUser.privacyAbout,
            });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("❌ Error in updateAppearanceSettings:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
