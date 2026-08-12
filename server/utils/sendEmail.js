import nodemailer from 'nodemailer';

/**
 * Gửi email sử dụng thư viện Nodemailer và Gmail SMTP
 * @param {Object} params
 * @param {String} params.to - Địa chỉ email người nhận
 * @param {String} params.subject - Tiêu đề email
 * @param {String} params.html - Nội dung email dưới dạng HTML
 * @returns {Promise<any>} Promise chứa thông tin kết quả gửi email
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    let transporter;

    // Nếu chưa cấu hình Gmail trong .env, tự động tạo tài khoản test Ethereal
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("[CẢNH BÁO] Chưa cấu hình EMAIL_USER và EMAIL_PASS trong .env!");
      console.log("[HỆ THỐNG] Đang tạo tài khoản Ethereal Email ảo để test gửi mail...");
      const testAccount = await nodemailer.createTestAccount();
      
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
    } else {
      // Khởi tạo transporter với cấu hình Gmail SMTP thật
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    }

    // Cấu hình các trường của email
    const mailOptions = {
      from: `"Chat Real-Time App" <${process.env.EMAIL_USER || 'test@ethereal.email'}>`,
      to,
      subject,
      html,
    };

    // Thực thi gửi email
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SUCCESS] Gửi email thành công tới ${to}. Message ID: ${info.messageId}`);
    
    // Nếu dùng Ethereal Email, in ra đường link để xem email ảo
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`[ETHEREAL] Xem email vừa gửi tại đây: ${nodemailer.getTestMessageUrl(info)}`);
    }
    
    return info;
  } catch (error) {
    console.error(`[ERROR] Lỗi khi gửi email tới ${to}:`, error.message);
    throw error;
  }
};

export default sendEmail;
