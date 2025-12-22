import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, Scale, ScrollText } from 'lucide-react';

const TermsPage = () => {
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
                        <Scale className="size-6" />
                        <span>ChatAppey</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="bg-base-100 rounded-3xl shadow-xl overflow-hidden">
                    {/* Title Section */}
                    <div className="bg-primary/5 p-8 sm:p-12 text-center border-b border-base-200">
                        <h1 className="text-3xl sm:text-4xl font-bold mb-4">Terms of Service</h1>
                        <p className="text-base-content/60 max-w-2xl mx-auto">
                            Please read these terms carefully before using our services. By using ChatAppey, you agree to be bound by these terms.
                        </p>
                        <p className="text-sm text-base-content/40 mt-4">Last Updated: December 22, 2025</p>
                    </div>

                    {/* Legal Text */}
                    <div className="p-8 sm:p-12 space-y-10">
                        <section className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                                <ScrollText className="size-6" />
                                <h2 className="text-xl font-bold">1. Acceptance of Terms</h2>
                            </div>
                            <p className="text-base-content/70 leading-relaxed">
                                By accessing and using ChatAppey ("the Service"), you acknowledge that you have read, understood, and agree to be bound by complying with complying with these Terms of Service. If you do not agree with any part of these terms, you are prohibited from using the Service.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                                <FileText className="size-6" />
                                <h2 className="text-xl font-bold">2. User Accounts</h2>
                            </div>
                            <p className="text-base-content/70 leading-relaxed">
                                When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                            </p>
                            <ul className="list-disc list-inside text-base-content/70 space-y-2 ml-4">
                                <li>You are responsible for safeguarding the password that you use to access the Service.</li>
                                <li>You agree not to disclose your password to any third party.</li>
                                <li>You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                                <Shield className="size-6" />
                                <h2 className="text-xl font-bold">3. Acceptable Use</h2>
                            </div>
                            <p className="text-base-content/70 leading-relaxed">
                                You agree not to use the Service to:
                            </p>
                            <ul className="list-disc list-inside text-base-content/70 space-y-2 ml-4">
                                <li>Violate any applicable laws or regulations.</li>
                                <li>Infringe upon the rights of others, including intellectual property rights.</li>
                                <li>Transmit any harmful, offensive, or illegal content.</li>
                                <li>Attempt to gain unauthorized access to any part of the Service.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                                <Scale className="size-6" />
                                <h2 className="text-xl font-bold">4. Termination</h2>
                            </div>
                            <p className="text-base-content/70 leading-relaxed">
                                We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. All provisions of the Terms which by their nature should survive termination shall survive termination.
                            </p>
                        </section>

                        <div className="divider"></div>

                        <div className="text-center space-y-4">
                            <p className="text-base-content/60">Have questions about our Terms?</p>
                            <Link to="/contacts" className="btn btn-primary px-8 rounded-full">Contact Support</Link>
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

export default TermsPage;
