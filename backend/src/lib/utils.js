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

export const generateToken = (userId, res) => {
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not defined in environment variables");
        }

        const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
            expiresIn: "7d"
        });

        const isProduction = process.env.NODE_ENV === "production";
        const frontendUrl = isProduction ? "https://chatappey.netlify.app" : "http://localhost:5173";

        res.cookie("jwt", token, {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: isProduction ? "none" : "lax",
            secure: isProduction,
            domain: isProduction ? ".netlify.app" : undefined,
            path: "/"
        });

        console.log(`Token generated and cookie set for ${userId}`);
        return token;
    } catch (error) {
        console.error("Error generating token:", error);
        throw error;
    }
};

export const verifyToken = (req, res, next) => {
    try {
        // Check both cookie and Authorization header
        const token = req.cookies.jwt || req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            console.error("No token found in request:", {
                cookies: req.cookies,
                headers: req.headers
            });
            return res.status(401).json({ error: "Unauthorized - No Token Provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        console.error("JWT Verification Error:", error);
        return res.status(401).json({ 
            error: "Unauthorized - Invalid Token",
            details: error.message 
        });
    }
};

