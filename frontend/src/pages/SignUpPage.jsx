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

    const { signup, isSigningUp } = useAuthStore();

    // Password requirements checker
    const passwordRequirements = [
        { label: '6+ characters', met: formData.password.length >= 6 },
        { label: 'A number', met: /[0-9]/.test(formData.password) },
        { label: 'A letter', met: /[a-zA-Z]/.test(formData.password) },
    ];

    const allRequirementsMet = passwordRequirements.every(req => req.met);

    const validateForm = () => {
        if (!formData.fullName.trim()) return toast.error("Full name is required");
        if (!formData.email.trim()) return toast.error("Email is required");
        if (!/\S+@\S+\.\S+/.test(formData.email)) return toast.error("Invalid email format");
        if (!formData.password) return toast.error("Password is required");
        if (formData.password.length < 6) return toast.error("Password must be at least 6 characters");

        return true;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const success = validateForm();

        if (success === true) signup(formData);
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
                                    Get Started
                                </h1>
                                <p className="text-base-content/50 mt-1 text-xs sm:text-sm">
                                    Create your free account today
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
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
                                        <span>Creating account...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Create Account</span>
                                        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

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