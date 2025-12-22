import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, Database, ShieldCheck, Shield } from 'lucide-react';

const PrivacyPage = () => {
    return (
        <div className="min-h-screen bg-base-200">
            {/* Header */}
            <div className="bg-base-100 shadow-sm sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/signup" className="btn btn-ghost gap-2">
                        <ArrowLeft className="size-5" />
                        Back to Sign Up
                    </Link>
                    <div className="flex items-center gap-2 font-semibold text-lg text-primary">
                        <Shield className="size-6" />
                        <span>ChatAppey</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="bg-base-100 rounded-3xl shadow-xl overflow-hidden">
                    {/* Title Section */}
                    <div className="bg-primary/5 p-8 sm:p-12 text-center border-b border-base-200">
                        <h1 className="text-3xl sm:text-4xl font-bold mb-4">Privacy Policy</h1>
                        <p className="text-base-content/60 max-w-2xl mx-auto">
                            Your privacy is important to us. This policy explains how we collect, use, and protect your personal information.
                        </p>
                        <p className="text-sm text-base-content/40 mt-4">Last Updated: December 22, 2025</p>
                    </div>

                    {/* Legal Text */}
                    <div className="p-8 sm:p-12 space-y-10">
                        <section className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                                <Database className="size-6" />
                                <h2 className="text-xl font-bold">1. Information We Collect</h2>
                            </div>
                            <p className="text-base-content/70 leading-relaxed">
                                We collect information you provide directly to us, such as when you create an account, update your profile, or communicate with us. This may include:
                            </p>
                            <ul className="list-disc list-inside text-base-content/70 space-y-2 ml-4">
                                <li>Personal identification information (Name, email address).</li>
                                <li>Profile information (Profile picture, status).</li>
                                <li>Communication data (Messages, media files).</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                                <Eye className="size-6" />
                                <h2 className="text-xl font-bold">2. How We Use Your Information</h2>
                            </div>
                            <p className="text-base-content/70 leading-relaxed">
                                We use the information we collect to provide, maintain, and improve our services, including to:
                            </p>
                            <ul className="list-disc list-inside text-base-content/70 space-y-2 ml-4">
                                <li>Create and manage your account.</li>
                                <li>Facilitate communication between users.</li>
                                <li>Send technical notices, updates, and security alerts.</li>
                                <li>Monitor and analyze trends and usage.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                                <Lock className="size-6" />
                                <h2 className="text-xl font-bold">3. Data Security</h2>
                            </div>
                            <p className="text-base-content/70 leading-relaxed">
                                We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction. However, no internet transmission is completely secure, and we cannot guarantee the security of your data.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                                <ShieldCheck className="size-6" />
                                <h2 className="text-xl font-bold">4. Your Rights</h2>
                            </div>
                            <p className="text-base-content/70 leading-relaxed">
                                You have the right to access, update, or delete your personal information at any time. You can manage your account settings within the application or contact us for assistance.
                            </p>
                        </section>

                        <div className="divider"></div>

                        <div className="text-center space-y-4">
                            <p className="text-base-content/60">Concerns about your privacy?</p>
                            <Link to="/contacts" className="btn btn-primary px-8 rounded-full">Contact Privacy Officer</Link>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-12 text-base-content/40 text-sm">
                    &copy; 2025 ChatAppey. All rights reserved.
                </div>
            </div>
        </div>
    );
};

export default PrivacyPage;
