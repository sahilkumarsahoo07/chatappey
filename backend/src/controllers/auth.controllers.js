import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { io } from "../lib/socket.js";
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

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
            generateToken(newUser._id, res);
            await newUser.save();

            res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                profilePic: newUser.profilePic,
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

        generateToken(user._id, res);

        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePic: user.profilePic,
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



const otpStorage = new Map();

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
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpId = uuidv4();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store OTP
    otpStorage.set(email, {
        otp,
        userId: user._id,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    // Email options
   const mailOptions = {
    from: `"Chat Appey" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Password Reset OTP',
    html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 640px; margin: 0 auto; border-radius: 20px; overflow: hidden; border: 1px solid #2a2a3a;">
            <!-- Glowing Header -->
            <div style="background: linear-gradient(135deg, #0f0f15 0%, #1e1b4b 100%); padding: 40px 32px; text-align: center; border-bottom: 1px solid rgba(99, 102, 241, 0.2); position: relative;">
                <div style="position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.6), transparent);"></div>
                
                <div style="display: inline-block; background: linear-gradient( 86.9deg,  rgba(253,189,38,1) 28.3%, rgba(253,109,38,1) 118.2% ); padding: 16px 24px; border-radius: 16px; backdrop-filter: blur(8px); border: 1px solid rgba(99, 102, 241, 0.3); box-shadow: 0 8px 32px rgba(99, 102, 241, 0.1);">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; background: linear-gradient(90deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px; text-shadow: 0 0 16px rgba(139, 92, 246, 0.4);">SECURE VERIFICATION CODE</h1>
                </div>
                <p style="color: #838383; font-size: 14px; margin-top: 16px; letter-spacing: 0.5px; font-weight: 400;">DYNAMIC ONE-TIME PASSCODE • VALID FOR 5 MINUTES</p>
                
                <div style="position: absolute; bottom: -1px; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.6), transparent);"></div>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 32px; background: linear-gradient(135deg, #0f0f15 0%, #111827 100%);">
                <div style="margin-bottom: 32px;">
                    <p style="color: #525252; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
                        You've initiated a <span style="color: #8b5cf6; font-weight: 600;">secure authentication sequence</span>. 
                        Use the following verification code to complete your request:
                    </p>
                </div>

                <!-- Cyber OTP Display -->
                <div style="background: rgb(20 20 30 / 93%); border-radius: 16px; padding: 32px; text-align: center; border: 1px solid #2a2a3a; box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3); margin-bottom: 40px; position: relative; overflow: hidden;">
                    <!-- Animated background elements -->
                    <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%); animation: rotate 20s linear infinite;"></div>
                    
                    <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 16px; letter-spacing: 1px; font-weight: 500; position: relative;">YOUR VERIFICATION TOKEN</p>
                    <div style="display: inline-block; color:white; padding: 20px 32px; border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.3); position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #8b5cf6, #6366f1, #3b82f6);"></div>
                        <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 10px; background: linear-gradient(90deg, #d946ef 0%, #6366f1 50%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 16px rgba(139, 92, 246, 0.4); padding-left: 5px;">${otp}</span>
                    </div>
                    <div style="margin-top: 24px; position: relative;">
                        <span style="display: inline-flex; align-items: center; background: rgba(239, 68, 68, 0.1); color: #ef4444; font-size: 13px; padding: 6px 16px; border-radius: 20px; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 500;">
                            <svg style="margin-right: 8px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            EXPIRES IN 5:00 • DO NOT SHARE
                        </span>
                    </div>
                </div>

                <!-- Security Notice -->
                <div style="background: rgb(20 20 30 / 93%); border-radius: 12px; padding: 20px; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 32px; position: relative;">
                    <div style="display: flex; align-items: flex-start;">
                        <div style="margin-right: 12px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        </div>
                        <div>
                            <h3 style="color: #fca5a5; font-size: 15px; margin: 0 0 8px 0; font-weight: 600;">SECURITY NOTICE</h3>
                            <p style="color: #a1a1aa; font-size: 13px; margin: 0; line-height: 1.6;">
                                For your protection, never share this code. Nexus Auth will never ask for this token via phone, email, or support. This code expires in 5 minutes.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 24px;">
                    <p style="color: #71717a; font-size: 12px; line-height: 1.6; margin-bottom: 8px;">
                        If you didn't request this code, your account may be compromised. Please secure your account immediately by changing your password and enabling two-factor authentication.
                    </p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
                        <p style="color: #71717a; font-size: 12px; margin: 0;">
                            © ${new Date().getFullYear()} <span style="color: #8b5cf6; font-weight: 500;">Chat Appey</span>
                        </p>
                        <div style="display: flex;">
                            <a href="#" style="margin-left: 16px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                                </svg>
                            </a>
                            <a href="#" style="margin-left: 16px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
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
    const storedOtp = otpStorage.get(email);  // ✅ Use email as key

    if (!storedOtp) {
      return res.status(404).json({
        success: false,
        message: 'OTP expired or invalid',
      });
    }

    if (Date.now() > storedOtp.expiresAt) {
      otpStorage.delete(email);
      return res.status(400).json({
        success: false,
        message: 'OTP expired',
      });
    }

    if (storedOtp.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
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
      });
    }

    otpStorage.delete(email);  // ✅ Clean up using email

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
    console.log(email,newPassword)
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

        io.emit('user-blocked', { 
            blockerId: currentUserId, 
            blockedId: userId 
        });

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

        io.emit('user-unblocked', { 
            unblockerId: currentUserId, 
            unblockedId: userId 
        });

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