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


export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ 
        message: "Unauthorized - No Token Provided",
        errorCode: "NO_TOKEN"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ 
        message: "Unauthorized - Invalid Token",
        errorCode: "INVALID_TOKEN"
      });
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ 
        message: "User not found",
        errorCode: "USER_NOT_FOUND"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        message: "Session expired, please login again",
        errorCode: "TOKEN_EXPIRED"
      });
    }
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        message: "Invalid token",
        errorCode: "JWT_ERROR"
      });
    }

    return res.status(500).json({ 
      message: "Internal server error",
      errorCode: "SERVER_ERROR"
    });
  }
};
