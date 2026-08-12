import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Link } from "react-router-dom";
import { Mail, Lock, User, Loader2, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";


const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const { signup, isSigningUp } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      await signup(formData);
      toast.success("Account created successfully!");
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.message || "Something went wrong";
      setErrorMsg(message);
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-sidebar-bg rounded-2xl shadow-xl p-8 border border-chat-bg">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-2 group">
            <div className="size-12 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
              <MessageSquare className="size-6 text-brand-red" />
            </div>
            <h1 className="text-2xl font-bold mt-2 text-gray-700">
              Create Account
            </h1>
            <p className="text-gray-400">Get started with your free account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium text-gray-700">
                Username
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="size-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="input input-bordered w-full pl-10 bg-chat-bg text-black border-none focus:ring-1 focus:ring-btn-primary"
                placeholder="johndoe"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium text-gray-700">
                Email
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="size-5 text-gray-400" />
              </div>
              <input
                type="email"
                className="input input-bordered w-full pl-10 bg-chat-bg text-black border-none focus:ring-1 focus:ring-btn-primary"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium text-gray-700">
                Password
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="size-5 text-gray-400" />
              </div>
              <input
                type="password"
                className="input input-bordered w-full pl-10 bg-chat-bg text-black border-none focus:ring-1 focus:ring-btn-primary"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>
          </div>



          {errorMsg && (
            <p className="text-red-400 text-sm text-center">{errorMsg}</p>
          )}

          <button
            type="submit"
            className="btn w-full bg-blue-600 hover:bg-blue-700 border-none text-white font-bold"
            disabled={isSigningUp}
          >
            {isSigningUp ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-gray-700">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
