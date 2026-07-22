'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function LoginPage() {
    const { login, isLoggedIn, isLoading } = useAuth();
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Dynamic State for Devs Info
    const [devUmar, setDevUmar] = useState({
        name: 'M. Umar Ajmal',
        bio: 'Software Eng. & Machine Learning',
        avatar: 'https://avatars.githubusercontent.com/u/126502013?v=4',
        url: 'https://muhammadumarajmal.vercel.app/'
    });

    const [devAbdullah, setDevAbdullah] = useState({
        name: 'Muhammad Abdullah',
        bio: 'AI Automation & Custom Software',
        avatar: 'https://raw.githubusercontent.com/AbdullahWali79/AbdullahImages/main/Professional.jpeg',
        url: 'https://muhammadabdullahwali.vercel.app/'
    });

    useEffect(() => {
        if (!isLoading && isLoggedIn) {
            router.replace('/');
        }
    }, [isLoading, isLoggedIn, router]);

    // Fetch dynamic GitHub data for Umar
    useEffect(() => {
        fetch('https://api.github.com/users/UmarAjmal')
            .then(res => res.json())
            .then(data => {
                if (data.name || data.avatar_url) {
                    setDevUmar(prev => ({
                        ...prev,
                        name: data.name || prev.name,
                        bio: data.bio || prev.bio,
                        avatar: data.avatar_url || prev.avatar
                    }));
                }
            })
            .catch(e => console.error('Failed to fetch Umar Ajmal data:', e));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username.trim() || !password) {
            setError('Please enter both username and password.');
            return;
        }
        setSubmitting(true);
        const result = await login(username.trim(), password);
        setSubmitting(false);
        if (result.success) {
            router.replace('/');
        } else {
            setError(result.message || 'Login failed. Please check your credentials.');
        }
    };

    const handleQuickFill = () => {
        setUsername('root');
        setPassword('root123');
        setError('');
    };

    if (isLoading) {
        return (
            <div className="loader-screen">
                <div className="spinner-glow" />
            </div>
        );
    }

    return (
        <div className="login-page">
            <AnimatedBackground />

            {/* Enhanced Ambient Background Glow Orbs */}
            <div className="ambient-glow orb-teal" />
            <div className="ambient-glow orb-orange" />
            <div className="ambient-glow orb-top-center" />

            <div className="content-wrapper">
                <main className="glass-board">
                    {/* Left Brand & Quote Panel */}
                    <div className="brand-panel">
                        <div className="brand-top">
                            {/* <div className="brand-header-badge">
                                <span className="brand-dot" />
                                <span>Unified Access Portal</span>
                            </div> */}

                            <div className="brand-hero">
                                <div className="brand-icon-halo">
                                    <i className="bi bi-mortarboard-fill" />
                                </div>
                                <h1 className="brand-title">
                                    Smart School <br />
                                    <span className="text-gradient">System</span>
                                </h1>
                            </div>
                        </div>

                        {/* Educational Quote Box */}
                        <div className="quote-container">
                            <div className="quote-icon-top">
                                <i className="bi bi-quote" />
                            </div>
                            <p className="quote-text">
                                &ldquo;Education is the most powerful weapon which you can use to change the world.&rdquo;
                            </p>
                            <div className="quote-author">
                                <span className="author-dash">&mdash;</span>
                                <span className="author-name">Nelson Mandela</span>
                            </div>
                        </div>

                        <div className="brand-footer-bar">
                            {/* <div className="role-tags">
                                <span className="role-tag"><i className="bi bi-shield-check" /> Admin</span>
                                <span className="role-tag"><i className="bi bi-journal-text" /> Teacher</span>
                                <span className="role-tag"><i className="bi bi-calculator" /> Accountant</span>
                                <span className="role-tag"><i className="bi bi-person-badge" /> Student</span>
                            </div> */}
                        </div>
                    </div>

                    {/* Right Form Panel */}
                    <div className="form-panel">
                        <div className="form-header">
                            <div className="form-avatar-icon">
                                <i className="bi bi-person-workspace" />
                            </div>
                            <h2>Welcome Back</h2>
                            <p>Sign in to access your portal account</p>
                        </div>

                        <form onSubmit={handleSubmit} noValidate className="login-form">
                            {error && (
                                <div className="error-alert animate__animated animate__headShake" role="alert">
                                    <i className="bi bi-exclamation-triangle-fill" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="form-group mb-3">
                                <label htmlFor="username-input">Username</label>
                                <div className="input-field-wrap">
                                    <i className="bi bi-person-fill input-icon" />
                                    <input
                                        id="username-input"
                                        type="text"
                                        className="form-input"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        disabled={submitting}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="form-group mb-4">
                                <label htmlFor="password-input">Password</label>
                                <div className="input-field-wrap">
                                    <i className="bi bi-lock-fill input-icon" />
                                    <input
                                        id="password-input"
                                        type={showPassword ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={submitting}
                                    />
                                    <button
                                        type="button"
                                        className="btn-toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} />
                                    </button>
                                </div>
                            </div>

                            <button type="submit" className="btn-submit" disabled={submitting}>
                                {submitting ? (
                                    <span className="submit-spinner" />
                                ) : (
                                    <>
                                        <span>Sign In to Portal</span>
                                        <i className="bi bi-arrow-right-short btn-arrow" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="credentials-card">
                            <div className="credentials-content">
                                <i className="bi bi-key-fill key-icon" />
                                <div className="credentials-info">
                                    <span className="credentials-label">Default Demo Credentials</span>
                                    <span className="credentials-val">Username: <strong>root</strong> &bull; Password: <strong>root123</strong></span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn-quick-fill"
                                onClick={handleQuickFill}
                                title="Auto fill demo credentials"
                            >
                                Auto Fill
                            </button>
                        </div>
                    </div>
                </main>
            </div>

            {/* Developer Credits Footer */}
            <footer className="dev-footer">
                <div className="dev-footer-title">
                    <span>Designed & Engineered By</span>
                </div>
                <div className="dev-cards-row">
                    <a
                        href={devUmar.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dev-card"
                    >
                        <div className="dev-avatar-wrapper">
                            <img src={devUmar.avatar} alt={devUmar.name} className="dev-avatar-img" />
                            <div className="dev-online-ring" />
                        </div>
                        <div className="dev-meta">
                            <span className="dev-role-badge">Full Stack Engineer</span>
                            <h3 className="dev-name">{devUmar.name}</h3>
                            <p className="dev-bio">{devUmar.bio}</p>
                        </div>
                        <i className="bi bi-box-arrow-up-right dev-external-icon" />
                    </a>

                    <div className="dev-card dev-card-static">
                        <div className="dev-avatar-wrapper">
                            <div className="dev-avatar-placeholder">A</div>
                        </div>
                        <div className="dev-meta">
                            <span className="dev-role-badge">SEO & Marketing</span>
                            <h3 className="dev-name">Abdullah</h3>
                            <p className="dev-bio">Search Engine Optimization Specialist</p>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Premium Styled JSX */}
            <style jsx>{`
                /* Loader */
                .loader-screen {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #0f1c24;
                }
                .spinner-glow {
                    width: 52px;
                    height: 52px;
                    border: 3px solid rgba(254, 127, 45, 0.2);
                    border-top-color: #FE7F2D;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Page Root Layout */
                .login-page {
                    position: relative;
                    min-height: 100vh;
                    background: #0f1c24;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    overflow-x: hidden;
                    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 36px 16px 24px;
                }

                /* Enhanced Ambient Background Glows */
                .ambient-glow {
                    position: fixed;
                    border-radius: 50%;
                    filter: blur(140px);
                    pointer-events: none;
                    z-index: 1;
                    opacity: 0.45;
                }
                .orb-teal {
                    width: 550px;
                    height: 550px;
                    background: radial-gradient(circle, rgba(33, 94, 97, 0.8) 0%, rgba(33, 94, 97, 0) 70%);
                    top: -120px;
                    left: -120px;
                }
                .orb-orange {
                    width: 500px;
                    height: 500px;
                    background: radial-gradient(circle, rgba(254, 127, 45, 0.6) 0%, rgba(254, 127, 45, 0) 70%);
                    bottom: -100px;
                    right: -100px;
                }
                .orb-top-center {
                    width: 400px;
                    height: 300px;
                    background: radial-gradient(circle, rgba(35, 61, 77, 0.7) 0%, rgba(15, 28, 36, 0) 70%);
                    top: 10%;
                    left: 50%;
                    transform: translateX(-50%);
                }

                /* Content Wrapper */
                .content-wrapper {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    max-width: 1060px;
                    margin: auto 0;
                    display: flex;
                    justify-content: center;
                }

                /* Glassmorphic Container */
                .glass-board {
                    display: flex;
                    width: 100%;
                    background: rgba(15, 28, 36, 0.75);
                    backdrop-filter: blur(28px);
                    -webkit-backdrop-filter: blur(28px);
                    border-radius: 28px;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    box-shadow: 0 35px 70px -15px rgba(0, 0, 0, 0.75),
                                0 0 50px rgba(33, 94, 97, 0.2);
                    overflow: hidden;
                }

                /* Brand & Quote Panel (Left) */
                .brand-panel {
                    flex: 1.25;
                    padding: 55px 48px;
                    color: white;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    background: linear-gradient(150deg, rgba(33, 94, 97, 0.45) 0%, rgba(23, 44, 56, 0.75) 100%);
                    border-right: 1px solid rgba(255, 255, 255, 0.08);
                    position: relative;
                }

                .brand-header-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.73rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1.2px;
                    background: rgba(254, 127, 45, 0.15);
                    color: #FE7F2D;
                    border: 1px solid rgba(254, 127, 45, 0.35);
                    padding: 6px 16px;
                    border-radius: 20px;
                    margin-bottom: 30px;
                }
                .brand-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #FE7F2D;
                    box-shadow: 0 0 8px #FE7F2D;
                }

                .brand-hero {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 36px;
                }
                .brand-icon-halo {
                    width: 68px;
                    height: 68px;
                    min-width: 68px;
                    border-radius: 20px;
                    background: linear-gradient(135deg, rgba(254, 127, 45, 0.25), rgba(33, 94, 97, 0.5));
                    border: 1.5px solid rgba(254, 127, 45, 0.45);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 10px 25px rgba(254, 127, 45, 0.3);
                }
                .brand-icon-halo i {
                    font-size: 2.2rem;
                    color: #FE7F2D;
                }
                .brand-title {
                    font-size: 2.35rem;
                    font-weight: 800;
                    line-height: 1.15;
                    letter-spacing: -0.5px;
                    margin: 0;
                }
                .text-gradient {
                    background: linear-gradient(135deg, #FFFFFF 30%, #FE7F2D 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                /* Educational Quote Container */
                .quote-container {
                    position: relative;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 28px 30px;
                    margin-bottom: 32px;
                    backdrop-filter: blur(10px);
                }
                .quote-icon-top i {
                    font-size: 2.2rem;
                    color: #FE7F2D;
                    opacity: 0.6;
                    line-height: 1;
                    display: block;
                    margin-bottom: 8px;
                }
                .quote-text {
                    font-size: 1.05rem;
                    font-style: italic;
                    line-height: 1.6;
                    color: rgba(240, 247, 236, 0.95);
                    margin-bottom: 16px;
                    font-weight: 300;
                }
                .quote-author {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .author-dash {
                    color: #FE7F2D;
                    font-weight: bold;
                }
                .author-name {
                    font-size: 0.92rem;
                    font-weight: 700;
                    color: #FE7F2D;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }

                .brand-footer-bar {
                    padding-top: 20px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }
                .role-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .role-tag {
                    font-size: 0.74rem;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.75);
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 5px 12px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .role-tag i {
                    color: #FE7F2D;
                    font-size: 0.85rem;
                }

                /* Form Panel (Right) */
                .form-panel {
                    flex: 1;
                    background: #ffffff;
                    padding: 55px 44px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .form-header {
                    text-align: center;
                    margin-bottom: 28px;
                }
                .form-avatar-icon {
                    width: 54px;
                    height: 54px;
                    margin: 0 auto 14px;
                    border-radius: 16px;
                    background: rgba(33, 94, 97, 0.08);
                    border: 1.5px solid rgba(33, 94, 97, 0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #215E61;
                    font-size: 1.55rem;
                }
                .form-header h2 {
                    font-size: 1.75rem;
                    font-weight: 800;
                    color: #1a2f3b;
                    margin-bottom: 6px;
                }
                .form-header p {
                    font-size: 0.88rem;
                    color: #64748b;
                }

                /* Error Alert */
                .error-alert {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    color: #dc2626;
                    padding: 12px 14px;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    margin-bottom: 20px;
                }
                .error-alert i {
                    font-size: 1.1rem;
                    flex-shrink: 0;
                }

                /* Form Groups & Inputs */
                .form-group label {
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: #334155;
                    margin-bottom: 6px;
                    display: block;
                }
                .input-field-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .input-icon {
                    position: absolute;
                    left: 14px;
                    color: #94a3b8;
                    font-size: 1.05rem;
                    transition: color 0.2s;
                    pointer-events: none;
                }
                .form-input {
                    width: 100%;
                    height: 48px;
                    padding: 0 42px 0 42px;
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 0.92rem;
                    color: #0f172a;
                    outline: none;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .form-input:focus {
                    background: #ffffff;
                    border-color: #215E61;
                    box-shadow: 0 0 0 4px rgba(33, 94, 97, 0.12);
                }
                .form-input:focus + .input-icon,
                .input-field-wrap:focus-within .input-icon {
                    color: #215E61;
                }
                .btn-toggle-password {
                    position: absolute;
                    right: 12px;
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                    transition: color 0.2s;
                }
                .btn-toggle-password:hover {
                    color: #215E61;
                }

                /* Submit Button */
                .btn-submit {
                    width: 100%;
                    height: 50px;
                    background: linear-gradient(135deg, #215E61 0%, #233D4D 100%);
                    border: none;
                    border-radius: 10px;
                    color: white;
                    font-size: 0.95rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    cursor: pointer;
                    box-shadow: 0 8px 20px rgba(33, 94, 97, 0.3);
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    margin-top: 6px;
                }
                .btn-submit:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 24px rgba(33, 94, 97, 0.4);
                    background: linear-gradient(135deg, #1b4f52 0%, #1a2f3b 100%);
                }
                .btn-submit:active:not(:disabled) {
                    transform: translateY(0);
                }
                .btn-arrow {
                    font-size: 1.3rem;
                    transition: transform 0.2s;
                }
                .btn-submit:hover:not(:disabled) .btn-arrow {
                    transform: translateX(4px);
                }
                .submit-spinner {
                    width: 22px;
                    height: 22px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                /* Credentials Helper Box */
                .credentials-card {
                    margin-top: 24px;
                    background: #f1f5f9;
                    border: 1px dashed #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 14px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                }
                .credentials-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .key-icon {
                    color: #215E61;
                    font-size: 1.1rem;
                }
                .credentials-info {
                    display: flex;
                    flex-direction: column;
                }
                .credentials-label {
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-weight: 700;
                    color: #64748b;
                }
                .credentials-val {
                    font-size: 0.8rem;
                    color: #1e293b;
                }
                .btn-quick-fill {
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    padding: 4px 10px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #215E61;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                .btn-quick-fill:hover {
                    background: #215E61;
                    color: white;
                    border-color: #215E61;
                }

                /* Developer Footer */
                .dev-footer {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    max-width: 1060px;
                    margin-top: 30px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .dev-footer-title {
                    margin-bottom: 16px;
                    position: relative;
                }
                .dev-footer-title span {
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: rgba(255, 255, 255, 0.45);
                    font-weight: 700;
                }
                .dev-cards-row {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    flex-wrap: wrap;
                    width: 100%;
                }
                .dev-card {
                    background: rgba(15, 23, 42, 0.55);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 16px 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    width: 360px;
                    max-width: 100%;
                    text-decoration: none;
                    color: white;
                    position: relative;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .dev-card:hover:not(.dev-card-static) {
                    transform: translateY(-4px);
                    background: rgba(33, 94, 97, 0.3);
                    border-color: rgba(254, 127, 45, 0.4);
                    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
                }
                .dev-card-static {
                    cursor: default;
                }
                .dev-avatar-wrapper {
                    position: relative;
                    width: 52px;
                    height: 52px;
                    flex-shrink: 0;
                }
                .dev-avatar-img {
                    width: 100%;
                    height: 100%;
                    border-radius: 14px;
                    object-fit: cover;
                    border: 2px solid rgba(255, 255, 255, 0.15);
                    transition: border-color 0.3s;
                }
                .dev-card:hover:not(.dev-card-static) .dev-avatar-img {
                    border-color: #FE7F2D;
                }
                .dev-avatar-placeholder {
                    width: 100%;
                    height: 100%;
                    border-radius: 14px;
                    background: linear-gradient(135deg, #FE7F2D, #e66e20);
                    color: white;
                    font-size: 1.4rem;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .dev-online-ring {
                    position: absolute;
                    bottom: -2px;
                    right: -2px;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #10B981;
                    border: 2px solid #0f1c24;
                }
                .dev-meta {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    min-width: 0;
                }
                .dev-role-badge {
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    font-weight: 700;
                    color: #FE7F2D;
                    margin-bottom: 2px;
                }
                .dev-name {
                    font-size: 0.98rem;
                    font-weight: 700;
                    color: #ffffff;
                    margin: 0 0 2px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .dev-bio {
                    font-size: 0.78rem;
                    color: rgba(255, 255, 255, 0.65);
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .dev-external-icon {
                    color: rgba(255, 255, 255, 0.4);
                    font-size: 0.9rem;
                    transition: color 0.2s, transform 0.2s;
                }
                .dev-card:hover:not(.dev-card-static) .dev-external-icon {
                    color: #FE7F2D;
                    transform: translate(2px, -2px);
                }

                /* Responsive Breakpoints */
                @media (max-width: 960px) {
                    .glass-board {
                        flex-direction: column;
                    }
                    .brand-panel {
                        padding: 40px 32px;
                        border-right: none;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    .form-panel {
                        padding: 40px 32px;
                    }
                }
                @media (max-width: 576px) {
                    .login-page {
                        padding: 16px 10px;
                    }
                    .brand-panel {
                        padding: 28px 20px;
                    }
                    .brand-title {
                        font-size: 1.85rem;
                    }
                    .form-panel {
                        padding: 28px 20px;
                    }
                    .dev-card {
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    );
}