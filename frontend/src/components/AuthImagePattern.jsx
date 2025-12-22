import React from 'react'
import { MessageSquare, Users, Sparkles, Shield, Zap, Heart } from 'lucide-react'

const AuthImagePattern = ({ title, subtitle }) => {
    const features = [
        { icon: MessageSquare, delay: '0s' },
        { icon: Users, delay: '0.1s' },
        { icon: Sparkles, delay: '0.2s' },
        { icon: Shield, delay: '0.3s' },
        { icon: Zap, delay: '0.4s' },
        { icon: Heart, delay: '0.5s' },
        { icon: MessageSquare, delay: '0.6s' },
        { icon: Users, delay: '0.7s' },
        { icon: Sparkles, delay: '0.8s' },
    ];

    return (
        <div className='hidden lg:flex items-center justify-center relative overflow-hidden'>
            {/* Gradient Background with Mesh Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-secondary/90">
                {/* Mesh Gradient Overlay */}
                <div className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: `radial-gradient(circle at 20% 30%, rgba(0,0,0,0.1) 0%, transparent 50%),
                                         radial-gradient(circle at 80% 70%, rgba(0,0,0,0.1) 0%, transparent 50%)`
                    }}
                ></div>
            </div>

            {/* Animated Gradient Orbs */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute w-96 h-96 rounded-full blur-3xl opacity-40
                    bg-primary-content/20
                    animate-blob top-0 -left-20"></div>
                <div className="absolute w-80 h-80 rounded-full blur-3xl opacity-30
                     bg-secondary-content/20
                    animate-blob bottom-0 right-0"
                    style={{ animationDelay: '2s' }}></div>
                <div className="absolute w-72 h-72 rounded-full blur-3xl opacity-30
                     bg-accent/20
                    animate-blob top-1/2 left-1/2"
                    style={{ animationDelay: '4s' }}></div>
            </div>

            {/* Floating Particles */}
            <div className="absolute inset-0 overflow-hidden">
                {[...Array(15)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-white/30 rounded-full animate-float"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${4 + Math.random() * 4}s`
                        }}
                    ></div>
                ))}
            </div>

            {/* Content Container */}
            <div className="relative z-10 max-w-sm text-center p-6 lg:p-8">
                {/* Glassmorphism Card */}
                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 lg:p-8
                    border border-white/10 shadow-2xl">
                    {/* Modern Grid Pattern */}
                    <div className="grid grid-cols-3 gap-2.5 lg:gap-3 mb-8">
                        {features.map((Feature, i) => (
                            <div
                                key={i}
                                className={`aspect-square rounded-xl lg:rounded-2xl flex items-center justify-center
                                    backdrop-blur-md transition-all duration-500 cursor-pointer
                                    ${i % 2 === 0
                                        ? 'bg-white/15 hover:bg-white/25'
                                        : 'bg-white/5 hover:bg-white/15'
                                    }
                                    border border-white/10 hover:border-white/30
                                    hover:shadow-lg hover:shadow-white/10
                                    hover:scale-105 group
                                    animate-fade-in-up`}
                                style={{
                                    animationDelay: Feature.delay,
                                    animationFillMode: 'both'
                                }}
                            >
                                <Feature.icon className={`w-4 h-4 lg:w-5 lg:h-5 text-white/70 
                                    group-hover:text-white group-hover:scale-110 transition-all duration-300
                                    ${i % 2 === 0 ? 'animate-pulse' : ''}`} />
                            </div>
                        ))}
                    </div>

                    {/* Title */}
                    <h2 className='text-xl lg:text-2xl font-bold mb-3 text-white animate-fade-in-up'
                        style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                        {title}
                    </h2>

                    {/* Subtitle */}
                    <p className="text-white/70 text-xs lg:text-sm leading-relaxed animate-fade-in-up"
                        style={{ animationDelay: '0.7s', animationFillMode: 'both' }}>
                        {subtitle}
                    </p>

                    {/* Bottom Decorative Element */}
                    <div className="mt-6 flex justify-center gap-1.5 animate-fade-in-up"
                        style={{ animationDelay: '0.9s', animationFillMode: 'both' }}>
                        {[...Array(3)].map((_, i) => (
                            <div
                                key={i}
                                className={`h-1 rounded-full transition-all duration-300 ${i === 1
                                    ? 'w-6 bg-white'
                                    : 'w-2 bg-white/40 hover:bg-white/60'
                                    }`}
                            ></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AuthImagePattern