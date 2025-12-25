import express from "express"
import authRoutes from './routes/auth.route.js'
import dotenv from 'dotenv';
import messageRoutes from './routes/message.route.js'
import friendRequestRoutes from './routes/friendRequest.route.js'
import notificationRoutes from './routes/notification.route.js'
import callRoutes from './routes/call.routes.js'
import groupRoutes from './routes/group.route.js'
import adminRoutes from './routes/admin.route.js'

import { connectDB } from './lib/db.js'
import cookieParser from "cookie-parser";
import cors from 'cors';
import { app, server } from './lib/socket.js'
import setupCronJobs from './lib/cron.js';
import session from "express-session";
import passport from "./lib/passport.js";

dotenv.config();
// const app = express();

setupCronJobs();



const PORT = process.env.PORT;
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(cors({
  // origin: "http://localhost:5173",
  origin: [
    "http://localhost:5173",
    "https://chatappey.onrender.com",
    "https://chatappey.netlify.app"
  ],
  credentials: true,
}));

app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());


app.use("/api/auth", authRoutes)
app.use("/api/messages", messageRoutes)
app.use("/api/friends", friendRequestRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/call", callRoutes)
app.use("/api/groups", groupRoutes);
app.use("/api/admin", adminRoutes);

server.listen(PORT, () => {
  console.log(`Server is running on this PORT http://localhost:${PORT}`)
  connectDB()
})