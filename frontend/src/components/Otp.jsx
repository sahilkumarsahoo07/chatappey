// src/components/Otp.jsx
import React, { useState } from "react";

const Otp = () => {
    const [email, setEmail] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [code, setCode] = useState(null);

    const handleEmailChange = (e) => setEmail(e.target.value);

    const handleSendOtp = async () => {
        if (!email) {
            setError("Please enter a valid email.");
            return;
        }
        setLoading(true);
        setError("");

        try {
            const response = await fetch("http://localhost:5001/api/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();
            if (data.success) {
                setOtpSent(true);
                setCode(data.code); // store OTP if needed for verification step
            } else {
                setError(data.message || "Failed to send OTP.");
            }
        } catch (err) {
            setError("Error sending OTP.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-4 bg-white shadow-lg rounded-lg">
            <h2 className="text-2xl font-semibold text-center text-gray-800 mb-4">
                OTP Verification
            </h2>

            <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={handleEmailChange}
                className="w-full p-3 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full p-3 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
            >
                {loading ? "Sending..." : "Send OTP"}
            </button>

            {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
            {otpSent && (
                <p className="mt-3 text-green-500 text-sm">
                    OTP sent to your email! Your code is {code}
                </p>
            )}
        </div>
    );
};

export default Otp;
