import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import AuthImagePattern from "../components/AuthImagePattern";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, ArrowRight } from "lucide-react";

const LoginPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [focusedField, setFocusedField] = useState(null);
    const { login, isLoggingIn } = useAuthStore();

    const handleSubmit = async (e) => {
        e.preventDefault();
        login(formData);
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-base-100">
            {/* Left Side - Form */}
            <div className="flex flex-col justify-center items-center px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-8 relative overflow-hidden">
                {/* Subtle Background Gradient */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full 
                        bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full 
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
                                    Welcome Back
                                </h1>
                                <p className="text-base-content/50 mt-1 text-xs sm:text-sm">
                                    Sign in to continue to ChatAppey
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                        <form onSubmit={handleSubmit} className="space-y-4">
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
                                <div className="flex justify-between items-center pl-1 pr-1">
                                    <label className="text-xs sm:text-sm font-medium text-base-content/70">
                                        Password
                                    </label>
                                    <Link
                                        to="/loginhelp"
                                        className="text-xs text-primary hover:text-primary-focus 
                                            font-medium transition-colors"
                                    >
                                        Forgot?
                                    </Link>
                                </div>
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
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="btn btn-primary w-full h-10 sm:h-11 rounded-xl text-sm sm:text-base shadow-lg
                                    flex items-center justify-center gap-2"
                                disabled={isLoggingIn}
                            >
                                {isLoggingIn ? (
                                    <>
                                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                        <span>Signing in...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Continue</span>
                                        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Divider & Sign Up Link */}
                    <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-base-content/20 to-transparent"></div>
                            <span className="text-base-content/40 text-xs">New to ChatAppey?</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-base-content/20 to-transparent"></div>
                        </div>

                        <Link
                            to="/signup"
                            className="block w-full py-2.5 sm:py-3 rounded-xl text-center text-sm
                                font-medium text-primary border-2 border-primary/20
                                hover:bg-primary/5 hover:border-primary/50
                                transition-all duration-300"
                        >
                            Create an account
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right Side - Pattern */}
            <AuthImagePattern
                title={"Welcome back!"}
                subtitle={"Sign in to continue your conversations and catch up with your messages."}
            />
        </div>
    );
};

export default LoginPage;