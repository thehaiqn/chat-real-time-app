import User from "../models/User.js";
import bcrypt from "bcryptjs";
import generateTokenAndSetCookie from "../utils/generateToken.js";

// 1. ĐĂNG KÝ
export const register = async (req, res) => {
  try {
    const { username, email, password, phoneNumber, gender } = req.body;

    // Kiểm tra tài khoản tồn tại chưa
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: "Email already exists" });
      }
      return res.status(400).json({ error: "Username already exists" });
    }
    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // Tạo user mới
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      phoneNumber: phoneNumber || "",
      gender: gender || "Other",
    });

    if (newUser) {
      await newUser.save();
      generateTokenAndSetCookie(newUser._id, res);
      res.status(201).json({
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        profilePic: newUser.profilePic,
        friends: newUser.friends,
      });
    } else {
      res.status(400).json({ error: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in register controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// 2. ĐĂNG NHẬP
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user?.password || "",
    );

    if (!user || !isPasswordCorrect) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    generateTokenAndSetCookie(user._id, res);

    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
      friends: user.friends,
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";

// Yêu cầu đặt lại mật khẩu
export const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res
        .status(404)
        .json({ error: "There is no user with that email" });
    }

    // Generate token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set expire
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // Create reset url
    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Password reset token",
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
      });

      res.status(200).json({ message: "Email sent" });
    } catch (err) {
      console.log(err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      return res.status(500).json({ error: "Email could not be sent" });
    }
  } catch (error) {
    console.log("Error in forgotPassword controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// Đặt lại mật khẩu mới
export const resetPassword = async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid token" });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    generateTokenAndSetCookie(user._id, res);

    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
      friends: user.friends,
    });
  } catch (error) {
    console.log("Error in resetPassword controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// Đăng nhập bằng mạng xã hội
export const socialLogin = async (req, res) => {
  try {
    const { email, username, profilePic } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user if they don't exist
      const generatedPassword = crypto.randomBytes(16).toString("hex");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(generatedPassword, salt);

      user = new User({
        username,
        email,
        password: hashedPassword,
        profilePic: profilePic || "",
      });
      await user.save();
    }

    generateTokenAndSetCookie(user._id, res);

    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
      friends: user.friends,
    });
  } catch (error) {
    console.log("Error in socialLogin controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Yêu cầu OTP quên mật khẩu
export const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng với email này" });
    }

    // Sinh mã OTP 6 số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Băm OTP
    const salt = await bcrypt.genSalt(10);
    const hashedOTP = await bcrypt.hash(otp, salt);

    // Lưu vào User
    user.resetPasswordToken = hashedOTP;
    user.resetPasswordExpire = Date.now() + 5 * 60 * 1000; // 5 phút
    user.otpAttempts = 0; // Reset số lần nhập sai khi gửi OTP mới
    await user.save();

    // Gửi email
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #1a73e8; text-align: center;">Yêu cầu lấy lại mật khẩu</h2>
        <p>Chào <strong>${user.username}</strong>,</p>
        <p>Bạn vừa yêu cầu lấy lại mật khẩu cho tài khoản tại Chat Real-Time App. Mã xác thực OTP của bạn là:</p>
        <div style="background-color: #f1f3f4; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="margin: 0; color: #d93025; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p style="color: #5f6368; font-size: 14px;">Mã OTP này có hiệu lực trong vòng <strong>5 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: "Mã xác thực OTP đặt lại mật khẩu",
      html: htmlTemplate,
    });

    res.status(200).json({ message: "Mã OTP đã được gửi đến email của bạn" });
  } catch (error) {
    console.log("Error in requestOTP controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Xác thực OTP và đặt lại mật khẩu
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user || !user.resetPasswordToken) {
      return res.status(400).json({ error: "Mã OTP đã hết hạn hoặc email không hợp lệ" });
    }

    // Kiểm tra số lần nhập sai
    if (user.otpAttempts >= 5) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.status(429).json({ error: "Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã OTP mới." });
    }

    // So sánh OTP
    const isOTPCorrect = await bcrypt.compare(otp, user.resetPasswordToken);
    if (!isOTPCorrect) {
      user.otpAttempts += 1;
      
      if (user.otpAttempts >= 5) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        return res.status(429).json({ error: "Bạn đã nhập sai OTP quá 5 lần. Mã OTP đã bị hủy, vui lòng yêu cầu mã mới." });
      }
      
      await user.save();
      return res.status(400).json({ error: `Mã OTP không chính xác. Bạn còn ${5 - user.otpAttempts} lần thử.` });
    }

    // Hash mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.otpAttempts = 0;
    await user.save();

    res.status(200).json({ message: "Mật khẩu đã được cập nhật thành công" });
  } catch (error) {
    console.log("Error in verifyOTP controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
