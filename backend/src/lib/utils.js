// import jwt from "jsonwebtoken";


// export const generateToken = (userId, res) => {
//     const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
//         expiresIn: "7d"
//     });

//     res.cookie("jwt", token, {
//         maxAge: 7 * 24 * 60 * 60 * 100, //milliseconds
//         httpOnly: true, //prevent XSS attacks cross-site scripting attacks
//         sameSite: "strict",  //CSRF attacks cross-site request forgery attacks
//         secure: process.env.NODE_ENV !== "development"
//     })
//     return token;
// }

import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const login = async (req, res) => {
  const { email, password } = req.body;

  // Find user & verify password (your logic here)
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Generate JWT token
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  // Set cookie with token
  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  });

  res.json({ message: "Login successful", user: { id: user._id, email: user.email } });
};


