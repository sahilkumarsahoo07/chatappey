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

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const isProduction = process.env.NODE_ENV === "production";
  
  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    domain: isProduction ? "https://chatappey.onrender.com" : undefined, // Add if using custom domain
    path: "/",
  });

  return token;
};


