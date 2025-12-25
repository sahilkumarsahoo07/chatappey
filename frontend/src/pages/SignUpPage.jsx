import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, User, ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";

import AuthImagePattern from "../components/AuthImagePattern";
import toast from "react-hot-toast";

const SignUpPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState(null);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
    });
    const [step, setStep] = useState(0); // 0: signup form, 1: OTP verification
    const [otp, setOtp] = useState(Array(6).fill(""));

    const { signupOTP, verifySignup, isSigningUp, isVerifyingOTP, loginWithGoogle } = useAuthStore();

    // Password requirements checker
    const passwordRequirements = [
        { label: '6+ characters', met: formData.password.length >= 6 },
        { label: 'A number', met: /[0-9]/.test(formData.password) },
        { label: 'A letter', met: /[a-zA-Z]/.test(formData.password) },
    ];

    const validateForm = () => {
        if (!formData.fullName.trim()) return toast.error("Full name is required");
        if (!formData.email.trim()) return toast.error("Email is required");
        if (!/\S+@\S+\.\S+/.test(formData.email)) return toast.error("Invalid email format");
        if (!formData.password) return toast.error("Password is required");
        if (formData.password.length < 6) return toast.error("Password must be at least 6 characters");

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = validateForm();
        if (success === true) {
            const result = await signupOTP(formData);
            if (result) setStep(1);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        const otpString = otp.join("");
        if (otpString.length !== 6) return toast.error("Please enter a 6-digit OTP");
        await verifySignup({ email: formData.email, otp: otpString });
    };

    const handleOtpChange = (element, index) => {
        if (isNaN(element.value)) return false;

        setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

        // Focus next input
        if (element.nextSibling && element.value !== "") {
            element.nextSibling.focus();
        }
    };

    const handleOtpKeyDown = (e, index) => {
        if (e.key === "Backspace") {
            if (otp[index] === "" && e.target.previousSibling) {
                e.target.previousSibling.focus();
            }
        }
    };

    const handlePaste = (e) => {
        const data = e.clipboardData.getData("text");
        if (!/^\d{6}$/.test(data)) return;

        const digits = data.split("");
        setOtp(digits);

        // Focus the last input after pasting
        const inputs = document.querySelectorAll(".otp-input");
        inputs[5].focus();
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-base-100">
            {/* Left Side - Form */}
            <div className="flex flex-col justify-center items-center px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-8 relative overflow-hidden">
                {/* Subtle Background Gradient */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
                    <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full 
                        bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-3xl"></div>
                    <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full 
                        bg-gradient-to-br from-secondary/20 via-secondary/10 to-transparent blur-3xl"></div>
                </div>

                <div className="w-full max-w-sm lg:max-w-md space-y-5 relative z-10">
                    {/* Logo & Header */}
                    <div className="text-center animate-fade-in-up">
                        <div className="flex flex-col items-center gap-2">
                            {/* Logo */}
                            <div className="relative group">
                                <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg 
                                    opacity-50 group-hover:opacity-70 transition-opacity duration-300"></div>
                                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 
                                    flex items-center justify-center shadow-lg 
                                    group-hover:scale-105 transition-transform duration-300">
                                    <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                                </div>
                            </div>

                            {/* Welcome Text */}
                            <div className="mt-3">
                                <h1 className="text-2xl font-bold text-base-content">
                                    {step === 0 ? "Get Started" : "Verify Email"}
                                </h1>
                                <p className="text-base-content/50 mt-1 text-xs sm:text-sm">
                                    {step === 0 ? "Create your free account today" : `Enter the code sent to ${formData.email}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* OTP Step */}
                    {step === 1 && (
                        <div className="animate-fade-in-up">
                            <form onSubmit={handleVerifyOtp} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-center gap-2 sm:gap-3">
                                        {otp.map((data, index) => (
                                            <input
                                                key={index}
                                                type="text"
                                                maxLength="1"
                                                className="otp-input w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold 
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
                                    <p className="text-center text-xs text-base-content/50">
                                        Enter the 6-digit verification code sent to your email
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary w-full h-11 sm:h-12 rounded-xl text-sm sm:text-base shadow-lg
                                        flex items-center justify-center gap-2"
                                    disabled={isVerifyingOTP}
                                >
                                    {isVerifyingOTP ? (
                                        <>
                                            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                            <span>Verifying...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Verify OTP</span>
                                            <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </>
                                    )}
                                </button>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={() => setStep(0)}
                                        className="text-sm font-medium text-primary hover:underline transition-all"
                                    >
                                        Change email / Back
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Form Step */}
                    {step === 0 && (
                        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                            <form onSubmit={handleSubmit} className="space-y-3.5">
                                {/* Full Name Field */}
                                <div className="space-y-1.5">
                                    <label className="text-xs sm:text-sm font-medium text-base-content/70 pl-1">
                                        Full Name
                                    </label>
                                    <div className={`relative transition-all duration-300 ${focusedField === 'fullName' ? 'transform scale-[1.01]' : ''
                                        }`}>
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <User className={`h-4 w-4 sm:h-[18px] sm:w-[18px] transition-all duration-300 ${focusedField === 'fullName'
                                                ? 'text-primary scale-110'
                                                : 'text-base-content/40'
                                                }`} />
                                        </div>
                                        <input
                                            type="text"
                                            className={`input w-full pl-10 sm:pl-11 pr-4 h-10 sm:h-11 text-sm sm:text-base
                                            rounded-xl border-2 bg-base-100/50 backdrop-blur-sm
                                            transition-all duration-300
                                            ${focusedField === 'fullName'
                                                    ? 'border-primary shadow-lg shadow-primary/10'
                                                    : 'border-base-content/10 hover:border-base-content/20'
                                                }`}
                                            placeholder="John Doe"
                                            value={formData.fullName}
                                            onFocus={() => setFocusedField('fullName')}
                                            onBlur={() => setFocusedField(null)}
                                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Email Field */}
                                <div className="space-y-1.5">
                                    <label className="text-xs sm:text-sm font-medium text-base-content/70 pl-1">
                                        Email Address
                                    </label>
                                    <div className={`relative transition-all duration-300 ${focusedField === 'email' ? 'transform scale-[1.01]' : ''
                                        }`}>
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Mail className={`h-4 w-4 sm:h-[18px] sm:w-[18px] transition-all duration-300 ${focusedField === 'email'
                                                ? 'text-primary scale-110'
                                                : 'text-base-content/40'
                                                }`} />
                                        </div>
                                        <input
                                            type="email"
                                            className={`input w-full pl-10 sm:pl-11 pr-4 h-10 sm:h-11 text-sm sm:text-base
                                            rounded-xl border-2 bg-base-100/50 backdrop-blur-sm
                                            transition-all duration-300
                                            ${focusedField === 'email'
                                                    ? 'border-primary shadow-lg shadow-primary/10'
                                                    : 'border-base-content/10 hover:border-base-content/20'
                                                }`}
                                            placeholder="you@example.com"
                                            value={formData.email}
                                            onFocus={() => setFocusedField('email')}
                                            onBlur={() => setFocusedField(null)}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Password Field */}
                                <div className="space-y-1.5">
                                    <label className="text-xs sm:text-sm font-medium text-base-content/70 pl-1">
                                        Password
                                    </label>
                                    <div className={`relative transition-all duration-300 ${focusedField === 'password' ? 'transform scale-[1.01]' : ''
                                        }`}>
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Lock className={`h-4 w-4 sm:h-[18px] sm:w-[18px] transition-all duration-300 ${focusedField === 'password'
                                                ? 'text-primary scale-110'
                                                : 'text-base-content/40'
                                                }`} />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className={`input w-full pl-10 sm:pl-11 pr-11 h-10 sm:h-11 text-sm sm:text-base
                                            rounded-xl border-2 bg-base-100/50 backdrop-blur-sm
                                            transition-all duration-300
                                            ${focusedField === 'password'
                                                    ? 'border-primary shadow-lg shadow-primary/10'
                                                    : 'border-base-content/10 hover:border-base-content/20'
                                                }`}
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onFocus={() => setFocusedField('password')}
                                            onBlur={() => setFocusedField(null)}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-base-content/40 
                                                hover:text-primary transition-colors" />
                                            ) : (
                                                <Eye className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-base-content/40 
                                                hover:text-primary transition-colors" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Password Requirements */}
                                    {formData.password && (
                                        <div className="flex flex-wrap gap-2 mt-2 animate-fade-in-up">
                                            {passwordRequirements.map((req, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs
                                                    transition-all duration-300
                                                    ${req.met
                                                            ? 'bg-emerald-500/10 text-emerald-600'
                                                            : 'bg-base-content/5 text-base-content/50'
                                                        }`}
                                                >
                                                    <Check className={`h-3 w-3 ${req.met ? 'opacity-100' : 'opacity-30'}`} />
                                                    <span>{req.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    className="btn btn-primary w-full h-10 sm:h-11 rounded-xl text-sm sm:text-base shadow-lg
                                    flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                    disabled={isSigningUp}
                                >
                                    {isSigningUp ? (
                                        <>
                                            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                            <span>Sending OTP...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Create Account</span>
                                            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Google Signup Button */}
                            <div className="mt-4">
                                <button
                                    onClick={loginWithGoogle}
                                    className="btn btn-outline w-full h-10 sm:h-11 rounded-xl text-sm sm:text-base
                                    flex items-center justify-center gap-2 border-2 border-base-content/10 
                                    hover:bg-base-content/5 transition-all duration-300"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    <span>Sign up with Google</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Terms & Sign In Link */}
                    <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <p className="text-[10px] sm:text-xs text-center text-base-content/40 leading-relaxed">
                            By creating an account, you agree to our{' '}
                            <Link to="/terms" className="text-primary cursor-pointer hover:underline">Terms of Service</Link>
                            {' '}and{' '}
                            <Link to="/privacy" className="text-primary cursor-pointer hover:underline">Privacy Policy</Link>
                        </p>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-base-content/20 to-transparent"></div>
                            <span className="text-base-content/40 text-xs">Already have an account?</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-base-content/20 to-transparent"></div>
                        </div>

                        <Link
                            to="/login"
                            className="block w-full py-2.5 sm:py-3 rounded-xl text-center text-sm
                                font-medium text-primary border-2 border-primary/20
                                hover:bg-primary/5 hover:border-primary/50
                                transition-all duration-300"
                        >
                            Sign in instead
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right Side - Pattern */}
            <AuthImagePattern
                title="Join our community"
                subtitle="Connect with friends, share moments, and stay in touch with your loved ones."
            />
        </div>
    );
};

export default SignUpPage;