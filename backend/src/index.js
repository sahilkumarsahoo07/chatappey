import express from "express"
import authRoutes from './routes/auth.route.js'
import dotenv from 'dotenv';
import messageRoutes from './routes/message.route.js'

import { connectDB } from './lib/db.js'
import cookieParser from "cookie-parser";
import cors from 'cors';
import { app, server } from './lib/socket.js'

dotenv.config();
// const app = express();



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


app.use("/api/auth", authRoutes)
app.use("/api/messages", messageRoutes)

server.listen(PORT, () => {
    console.log(`Server is running on this PORT http://localhost:${PORT}`)
    connectDB()
})