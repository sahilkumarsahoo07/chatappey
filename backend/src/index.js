import express from "express";
import authRoutes from './routes/auth.route.js';
import dotenv from 'dotenv';
import messageRoutes from './routes/message.route.js';
import { connectDB } from './lib/db.js';
import cookieParser from "cookie-parser";
import cors from 'cors';
import { app, server } from './lib/socket.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

// Enhanced CORS configuration
const corsOptions = {
    origin: [
        "http://localhost:5173",
        "https://chatappey.netlify.app"
    ],
    credentials: true,
    exposedHeaders: ['set-cookie'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Debug middleware
app.use((req, res, next) => {
    console.log('\n=== Incoming Request ===');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Cookies:', req.cookies);
    console.log('Headers:', req.headers);
    next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        environment: process.env.NODE_ENV || 'development',
        jwtSecret: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
        cors: {
            origin: corsOptions.origin,
            credentials: corsOptions.credentials
        }
    });
});

server.listen(PORT, () => {
    console.log(`\nServer is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Allowed Origins: ${corsOptions.origin.join(', ')}`);
    console.log(`JWT Secret: ${process.env.JWT_SECRET ? '*****' : 'NOT SET!'}`);
    connectDB();
});