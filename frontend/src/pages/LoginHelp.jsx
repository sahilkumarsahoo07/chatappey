import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Mail, Loader2, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthImagePattern from "../components/AuthImagePattern";
import toast from "react-hot-toast";

const LoginHelp = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOtpField, setShowOtpField] = useState(false);
    const [showPasswordFields, setShowPasswordFields] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [countdown, setCountdown] = useState(30);
    const [otpId, setOtpId] = useState("");

    const { sendOtp, verifyOtp, resetPassword } = useAuthStore();

    // Countdown timer effect
    useEffect(() => {
        let timer;
        if (showOtpField && countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown, showOtpField]);

    // Reset countdown when OTP field is shown
    useEffect(() => {
        if (showOtpField) {
            setCountdown(30);
        }
    }, [showOtpField]);

    // const handleResendOtp = () => {
    // setIsSubmitting(true);
    // // Simulate API call to resend OTP
    // setTimeout(() => {
    //     setIsSubmitting(false);
    //     setCountdown(60); // Reset countdown
    //     toast.success("OTP resent successfully");
    // }, 1000);
    // };

    const validateEmail = () => {
        if (!email.trim()) return toast.error("Email is required");
        if (!/\S+@\S+\.\S+/.test(email)) return toast.error("Invalid email format");
        return true;
    };

    const validateOtp = () => {
        if (!otp.trim()) return toast.error("OTP is required");
        if (otp.length !== 4) return toast.error("OTP must be 4 digits");
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
            const data = await sendOtp(email);
            setOtpId(data.otpId);
            setShowOtpField(true);
            toast.success("OTP sent to your email");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to send OTP");
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!validateOtp()) return;

        setIsSubmitting(true);
        try {
            await verifyOtp(email, otp);  // ✅ no otpId
            setShowPasswordFields(true);
            toast.success("OTP verified");
        } catch (error) {
            toast.error(error.response?.data?.message || "Invalid OTP");
        } finally {
            setIsSubmitting(false);
        }
    };

    // const handleResetPassword = async (e) => {
    // e.preventDefault();
    // if (!validatePasswords()) return;

    // setIsSubmitting(true);
    // try {
    //     await verifyOtp({ otpId, otp, newPassword });
    //     toast.success("Password reset successfully");
    //     navigate('/login');
    // } catch (error) {
    //     toast.error(error.response?.data?.message || "Failed to reset password");
    // } finally {
    //     setIsSubmitting(false);
    // }
    // };

    const handleResendOtp = async () => {
        if (countdown > 0) return;

        setIsSubmitting(true);
        try {
            const data = await sendOtp(email);
            setOtpId(data.otpId);
            setCountdown(30);
            toast.success("OTP resent successfully");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to resend OTP");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();

        // Validate passwords
        if (!newPassword || !confirmPassword) {
            toast.error('Both password fields are required');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

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

    // const handlePasswordReset = (e) => {
    //     e.preventDefault();
    //     if (validatePasswords()) {
    //         setIsSubmitting(true);
    //         // Simulate password reset API call
    //         setTimeout(() => {
    //             setIsSubmitting(false);
    //             toast.success("Password updated successfully");
    //             navigate("/login");
    //         }, 1500);
    //     }
    // };


    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* left side */}
            <div className="flex flex-col justify-center items-center p-6 sm:p-12 relative overflow-hidden">
                {/* Subtle Background Gradient */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full 
                        bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full 
                        bg-gradient-to-br from-secondary/20 via-secondary/10 to-transparent blur-3xl"></div>
                </div>
                <div className="w-full max-w-md space-y-8 relative z-10">
                    {/* LOGO */}
                    <div className="text-center mb-8">
                        <div className="flex flex-col items-center gap-2 group">
                            <div
                                className="size-12 rounded-xl bg-primary/10 flex items-center justify-center 
              group-hover:bg-primary/20 transition-colors"
                            >
                                <Lock className="size-6 text-primary" />
                            </div>
                            <h1 className="text-2xl font-bold mt-2">
                                {showPasswordFields ? "Set New Password" : showOtpField ? "Verify OTP" : "Forgot Password"}
                            </h1>
                            <p className="text-base-content/60">
                                {showPasswordFields
                                    ? "Enter your new password and confirm it"
                                    : showOtpField
                                        ? "Enter the 4-digit OTP sent to your email"
                                        : "Enter your email to receive a password reset OTP"}
                            </p>
                        </div>
                    </div>

                    {!showOtpField && !showPasswordFields && (
                        <form onSubmit={handleGetOtp} className="space-y-6">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Email</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-base-content/40 z-10" />
                                    </div>
                                    <input
                                        type="email"
                                        className="input input-bordered w-full pl-10"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting || !email.trim()} >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="size-5 animate-spin" />
                                        Sending OTP...
                                    </>
                                ) : (
                                    "Get OTP"
                                )}
                            </button>
                        </form>
                    )}

                    {showOtpField && !showPasswordFields && (
                        <form onSubmit={handleVerifyOtp} className="space-y-6 mb-2">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text mb-5 font-medium">Enter 4-digit OTP</span>
                                </label>
                                <div className="flex justify-center gap-3 mb-4">
                                    {[0, 1, 2, 3].map((index) => (
                                        <input
                                            key={index}
                                            type="text"
                                            className="input input-bordered w-16 text-center text-xl"
                                            maxLength={1}
                                            value={otp[index] || ''}
                                            onChange={(e) => {
                                                const newOtp = otp.split('');
                                                newOtp[index] = e.target.value.replace(/\D/g, '');
                                                setOtp(newOtp.join(''));

                                                // Auto focus to next input
                                                if (e.target.value && index < 3) {
                                                    document.getElementById(`otp-input-${index + 1}`).focus();
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                // Handle backspace to move to previous input
                                                if (e.key === 'Backspace' && !otp[index] && index > 0) {
                                                    document.getElementById(`otp-input-${index - 1}`).focus();
                                                }
                                            }}
                                            id={`otp-input-${index}`}
                                        />
                                    ))}
                                </div>

                                <div className="text-center mb-4">
                                    {countdown > 0 ? (
                                        <p className="text-sm text-base-content/60">
                                            Resend OTP in {countdown} seconds
                                        </p>
                                    ) : (
                                        <button
                                            type="button"
                                            className="btn btn-link text-sm"
                                            onClick={handleResendOtp}
                                        >
                                            Resend OTP
                                        </button>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary w-full"
                                    disabled={isSubmitting || otp.length !== 4}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="size-5 animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        "Verify OTP"
                                    )}
                                </button>
                            </div>

                            <button
                                type="button"
                                className="btn btn-ghost text-sm flex items-center gap-1"
                                onClick={() => setShowOtpField(false)}
                            >
                                <ArrowLeft className="size-4" />
                                Back to email
                            </button>
                        </form>
                    )}

                    {showPasswordFields && (
                        <form onSubmit={handleResetPassword} className="space-y-6">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">New Password</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-base-content/40 z-10" />
                                    </div>
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        className="input input-bordered w-full pl-10"
                                        placeholder="••••••••"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                    >
                                        {showNewPassword ? (
                                            <EyeOff className="h-5 w-5 text-base-content/40 z-10" />
                                        ) : (
                                            <Eye className="h-5 w-5 text-base-content/40 z-10" />
                                        )}
                                    </button>

                                </div>
                                <div className="mt-1 text-xs text-base-content/60">
                                    {newPassword.length > 0 && (
                                        <div className="space-y-1">
                                            <div className={`flex items-center ${newPassword.length >= 6 ? 'text-success' : 'text-error'}`}>
                                                {newPassword.length >= 6 ? '✓' : '•'} Minimum 6 characters
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Confirm Password</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-base-content/40 z-10" />
                                    </div>
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        className={`input input-bordered w-full pl-10 ${confirmPassword && newPassword !== confirmPassword ? 'input-error' : ''
                                            }`}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="h-5 w-5 text-base-content/40 z-10" />
                                        ) : (
                                            <Eye className="h-5 w-5 text-base-content/40 z-10" />
                                        )}
                                    </button>

                                </div>
                                {confirmPassword && newPassword !== confirmPassword && (
                                    <label className="label">
                                        <span className="label-text-alt text-error">Passwords don't match</span>
                                    </label>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary w-full"
                                disabled={
                                    isSubmitting ||
                                    newPassword.length < 6 ||
                                    confirmPassword.length < 6 ||
                                    newPassword !== confirmPassword
                                }
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="size-5 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    "Update Password"
                                )}
                            </button>
                        </form>
                    )}

                    <div className="text-center">
                        <p className="text-base-content/60">
                            Remember your password?{" "}
                            <Link to="/login" className="link link-primary">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* right side */}
            <AuthImagePattern
                title="Reset your password"
                subtitle="Secure your account with a new password"
            />
        </div>
    );
};

export default LoginHelp;