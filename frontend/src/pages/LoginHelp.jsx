import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Mail, Loader2, Lock, ArrowLeft, Eye, EyeOff, Check, KeyRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthImagePattern from "../components/AuthImagePattern";
import toast from "react-hot-toast";

const LoginHelp = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(Array(6).fill(""));
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOtpField, setShowOtpField] = useState(false);
    const [showPasswordFields, setShowPasswordFields] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [countdown, setCountdown] = useState(30);

    const { sendOtp, verifyOtp, resetPassword } = useAuthStore();
    const inputRefs = useRef([]);

    // Countdown timer effect
    useEffect(() => {
        let timer;
        if (showOtpField && countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown, showOtpField]);

    // Focus first OTP input when step changes
    useEffect(() => {
        if (showOtpField && !showPasswordFields) {
            setTimeout(() => {
                if (inputRefs.current[0]) inputRefs.current[0].focus();
            }, 100);
        }
    }, [showOtpField, showPasswordFields]);

    const validateEmail = () => {
        if (!email.trim()) return toast.error("Email is required");
        if (!/\S+@\S+\.\S+/.test(email)) return toast.error("Invalid email format");
        return true;
    };

    const validatePasswords = () => {
        if (!newPassword) return toast.error("Password is required");
        if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
        if (newPassword !== confirmPassword) return toast.error("Passwords don't match");
        return true;
    };

    const handleGetOtp = async (e) => {
        e.preventDefault();
        if (!validateEmail()) return;

        setIsSubmitting(true);
        try {
            await sendOtp(email);
            setShowOtpField(true);
            toast.success("OTP sent to your email");
        } catch (error) {
            toast.error(error.response?.data?.message || "User not found or failed to send OTP");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOtpChange = (element, index) => {
        if (isNaN(element.value)) return false;

        const newOtp = [...otp];
        newOtp[index] = element.value;
        setOtp(newOtp);

        // Focus next input
        if (element.value !== "" && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleOtpKeyDown = (e, index) => {
        if (e.key === "Backspace") {
            if (otp[index] === "" && index > 0) {
                inputRefs.current[index - 1].focus();
            }
        }
    };

    const handlePaste = (e) => {
        const data = e.clipboardData.getData("text");
        if (!/^\d{6}$/.test(data)) return;

        const digits = data.split("");
        setOtp(digits);
        inputRefs.current[5].focus();
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        const otpString = otp.join("");
        if (otpString.length !== 6) return toast.error("Please enter a 6-digit OTP");

        setIsSubmitting(true);
        try {
            await verifyOtp(email, otpString);
            setShowPasswordFields(true);
            toast.success("OTP verified");
        } catch (error) {
            toast.error(error.response?.data?.message || "Invalid or expired OTP");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendOtp = async () => {
        if (countdown > 0) return;

        setIsSubmitting(true);
        try {
            await sendOtp(email);
            setCountdown(30);
            setOtp(Array(6).fill(""));
            toast.success("OTP resent successfully");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to resend OTP");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!validatePasswords()) return;

        setIsSubmitting(true);
        try {
            await resetPassword({ email, newPassword });
            toast.success('Password reset successfully');
            navigate('/login');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset password');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-base-100">
            {/* Left Side - Form */}
            <div className="flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
                {/* Subtle Background Gradient */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full 
                        bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full 
                        bg-gradient-to-br from-secondary/20 via-secondary/10 to-transparent blur-3xl"></div>
                </div>

                <div className="w-full max-w-md space-y-8 relative z-10">
                    {/* LOGO & Header */}
                    <div className="text-center animate-fade-in-up">
                        <div className="flex flex-col items-center gap-3">
                            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center 
                                shadow-lg border border-primary/20 group-hover:scale-105 transition-transform duration-300">
                                {showPasswordFields ? <KeyRound className="size-6 text-primary" /> : <Lock className="size-6 text-primary" />}
                            </div>
                            <h1 className="text-2xl font-bold text-base-content">
                                {showPasswordFields ? "Secure New Password" : showOtpField ? "Verify OTP" : "Reset Password"}
                            </h1>
                            <p className="text-base-content/50 text-sm">
                                {showPasswordFields
                                    ? "Create a new strong password for your account"
                                    : showOtpField
                                        ? `Code sent to ${email}`
                                        : "We'll send you a verification code to reset your password"}
                            </p>
                        </div>
                    </div>

                    {!showOtpField && !showPasswordFields && (
                        <form onSubmit={handleGetOtp} className="space-y-6 animate-fade-in-up">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-base-content/70 pl-1">
                                    Email Address
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Mail className="h-[18px] w-[18px] text-base-content/40 group-focus-within:text-primary transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        className="input input-bordered w-full pl-11 h-11 rounded-xl transition-all border-2 
                                            focus:border-primary bg-base-100/50 backdrop-blur-sm shadow-sm"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary w-full h-11 rounded-xl shadow-lg flex items-center justify-center gap-2"
                                disabled={isSubmitting || !email.trim()}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="size-5 animate-spin" />
                                        <span>Sending OTP...</span>
                                    </>
                                ) : (
                                    <span>Get OTP Code</span>
                                )}
                            </button>
                        </form>
                    )}

                    {showOtpField && !showPasswordFields && (
                        <form onSubmit={handleVerifyOtp} className="space-y-8 animate-fade-in-up">
                            <div className="space-y-6">
                                <div className="flex justify-center gap-2 sm:gap-3">
                                    {otp.map((data, index) => (
                                        <input
                                            key={index}
                                            type="text"
                                            maxLength="1"
                                            ref={el => inputRefs.current[index] = el}
                                            className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold 
                                                rounded-xl border-2 border-base-content/10 bg-base-100/50 backdrop-blur-sm
                                                focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                            value={data}
                                            onChange={(e) => handleOtpChange(e.target, index)}
                                            onKeyDown={(e) => handleOtpKeyDown(e, index)}
                                            onPaste={index === 0 ? handlePaste : undefined}
                                            required
                                        />
                                    ))}
                                </div>

                                <div className="text-center">
                                    {countdown > 0 ? (
                                        <p className="text-xs text-base-content/40">
                                            Resend OTP in <span className="font-mono text-primary">{countdown}s</span>
                                        </p>
                                    ) : (
                                        <button
                                            type="button"
                                            className="text-sm font-medium text-primary hover:underline"
                                            onClick={handleResendOtp}
                                            disabled={isSubmitting}
                                        >
                                            Resend OTP Code
                                        </button>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary w-full h-11 rounded-xl shadow-lg flex items-center justify-center gap-2"
                                    disabled={isSubmitting || otp.join("").length !== 6}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="size-5 animate-spin" />
                                            <span>Verifying...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Verify OTP</span>
                                            <Check className="size-5" />
                                        </>
                                    )}
                                </button>
                            </div>

                            <button
                                type="button"
                                className="w-full flex justify-center items-center gap-2 text-sm font-medium text-base-content/60 
                                    hover:text-base-content transition-colors"
                                onClick={() => setShowOtpField(false)}
                            >
                                <ArrowLeft className="size-4" />
                                <span>Change email / Back</span>
                            </button>
                        </form>
                    )}

                    {showPasswordFields && (
                        <form onSubmit={handleResetPassword} className="space-y-6 animate-fade-in-up">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-base-content/70 pl-1">New Password</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-base-content/40 group-focus-within:text-primary transition-colors" />
                                        </div>
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            className="input input-bordered w-full pl-11 pr-11 h-11 rounded-xl border-2 transition-all focus:border-primary"
                                            placeholder="••••••••"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-base-content/40 hover:text-primary transition-colors"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                    {newPassword && (
                                        <div className={`mt-1 text-[10px] sm:text-xs flex items-center gap-1.5 ${newPassword.length >= 6 ? 'text-emerald-500' : 'text-error'}`}>
                                            <Check className={`size-3 ${newPassword.length >= 6 ? 'opacity-100' : 'opacity-30'}`} />
                                            <span>At least 6 characters required</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-base-content/70 pl-1">Confirm Password</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-base-content/40 group-focus-within:text-primary transition-colors" />
                                        </div>
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            className={`input input-bordered w-full pl-11 pr-11 h-11 rounded-xl border-2 transition-all 
                                                ${confirmPassword && newPassword !== confirmPassword ? 'border-error focus:border-error' : 'focus:border-primary'}`}
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-base-content/40 hover:text-primary transition-colors"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                    {confirmPassword && newPassword !== confirmPassword && (
                                        <p className="mt-1 text-xs text-error font-medium">Passwords do not match</p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary w-full h-11 rounded-xl shadow-lg"
                                disabled={isSubmitting || newPassword.length < 6 || newPassword !== confirmPassword}
                            >
                                {isSubmitting ? (
                                    <Loader2 className="size-5 animate-spin mx-auto" />
                                ) : (
                                    "Update Password"
                                )}
                            </button>
                        </form>
                    )}

                    <div className="text-center pt-4">
                        <p className="text-base-content/60 text-sm">
                            Wait, I remember it!{" "}
                            <Link to="/login" className="text-primary font-semibold hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side - Pattern */}
            <AuthImagePattern
                title="Reset your password"
                subtitle="Ensure your account stays secure with a strong new password."
            />
        </div>
    );
};

export default LoginHelp;