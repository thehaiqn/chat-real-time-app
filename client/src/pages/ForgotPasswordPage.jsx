import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { axiosInstance } from '../lib/axios';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axiosInstance.post('/auth/forgot-password', { email });
      toast.success('Password reset email sent!');
      setEmail('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-2">
            <div className="size-12 rounded-xl bg-red-100 flex items-center justify-center">
              <Key className="size-6 text-brand-red" />
            </div>
            <h1 className="text-2xl font-bold mt-2 text-gray-900">Forgot Password</h1>
            <p className="text-gray-500">Enter your email and we'll send you a reset link.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="size-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                className="block w-full pl-10 px-3 py-3 border border-gray-300 rounded-lg focus:ring-brand-red focus:border-brand-red sm:text-sm bg-gray-50 text-gray-900"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-black hover:bg-gray-800 focus:outline-none disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : 'Send Reset Link'}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Remember your password?{' '}
            <Link to="/login" className="font-semibold text-brand-red hover:text-red-700">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
