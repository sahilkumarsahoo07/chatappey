// import jwt from "jsonwebtoken";
// import User from '../models/user.model.js';
// import cookieParser from "cookie-parser";

// export const protectRoute = async (req, res, next) => {

//     try {
//         const token = req.cookies.jwt;

//         if (!token) {
//             return res.status(401).json({ message: "Unauthorize - No Token Provided" });
//         }
//         const decoded = jwt.verify(token, process.env.JWT_SECRET)
//         if (!decoded) {
//             return res.status(401).json({ message: "Unauthorize - Invalid Token" });
//         }
//         const user = await User.findById(decoded.userId).select("-password")

//         if (!user) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         req.user = user;
//         next();


//     } catch (error) {
//         console.log("Error in proctRoute middleware");
//         return res.status(500).json({ message: "Internal server error" });
//     }
// }


import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    // Check for token in cookies first, then in Authorization header
    let token = req.cookies.jwt;

    if (!token && req.headers.authorization) {
      // Check for Bearer token in Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No Token Provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error in protectRoute middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

