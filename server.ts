import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import fs from "fs";
import { generateEmailHtml, generateEmailBody } from "./src/lib/emailUtils";

// Load Firebase Config
let firebaseConfig: any = {};
try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
        firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (e) {
    console.warn("Could not load firebase-applet-config.json, relying on environment variables.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("SMTP Warning: GMAIL_USER or GMAIL_APP_PASSWORD not set. Email features will fail.");
  }

  // Email Transporter (Forcing hardcoded values as requested to bypass env var conflicts)
  const gmailUser = 'vasy.padelacademy@gmail.com';
  const rawAppPass = 'ygeo pzpb ipbv btoq';
  const gmailPass = rawAppPass.replace(/\s/g, '');
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass
    }
  });

  let cachedSmtpStatus = 'loading';

  // Verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      cachedSmtpStatus = 'auth_error';
      console.error("SMTP Connection Error:", error);
      console.log("--------------------------------------------------");
      console.log("EMAIL SETUP INSTRUCTIONS (SMTP BAD CREDENTIALS):");
      const rawPass = process.env.GMAIL_APP_PASSWORD || '';
      console.log("Current User:", gmailUser || "(not set)");
      console.log("Current Pass Length (Sanitized):", gmailPass.length, "chars");
      
      if (gmailUser && !gmailUser.includes('@')) {
        console.error("CRITICAL: GMAIL_USER does not look like an email address.");
      }
      if (gmailPass.length > 0 && gmailPass.length !== 16) {
        console.warn("CRITICAL: Your App Password length is NOT 16 chars. Gmail App Passwords MUST be exactly 16 characters (excluding spaces).");
      }
      if (rawPass.includes(' ')) {
        console.log("Note: Spaces detected and removed from App Password.");
      }
      console.log("1. Go to AI Studio Settings -> Environment Variables");
      console.log("2. Set GMAIL_USER to your full gmail address (e.g. vasy.padelacademy@gmail.com)");
      console.log("3. Set GMAIL_APP_PASSWORD to a 16-character App Password.");
      console.log("   (If it is not exactly 16 characters, it is probably not an App Password)");
      console.log("   CRITICAL: You MUST enable '2-Step Verification' on your Google Account first.");
      console.log("   Generate the App Password at: https://myaccount.google.com/apppasswords");
      console.log("   Check common mistakes:");
      console.log("   - Using your normal password (will NOT work)");
      console.log("   - Typing it with spaces (remove them)");
      console.log("   - Not having 2FA enabled on the account");
      console.log("--------------------------------------------------");
    } else {
      cachedSmtpStatus = 'ready';
      console.log("SMTP: Server is ready to take our messages");
    }
  });

  async function sendEmailNotification(to: string, subject: string, body: string, attachments?: any[], html?: string) {
    const mailOptions: any = {
      from: `"Vas-y Padel Academy" <${gmailUser}>`,
      to: to,
      subject: subject,
      text: body,
      attachments: attachments || []
    };
    if (html) {
      mailOptions.html = html;
    }

    try {
      if (cachedSmtpStatus !== 'ready') {
        const check = await transporter.verify();
        if (check) cachedSmtpStatus = 'ready';
      }
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully: %s', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error("SMTP Send Error:", error.message);
      if (error.code === 'EAUTH') cachedSmtpStatus = 'auth_error';
      throw error;
    }
  }

  // API routes FIRST
  app.get("/api/health", async (req, res) => {
    // If we're missing credentials, mark as missing immediately
    if (!gmailUser || !rawAppPass) {
       cachedSmtpStatus = 'missing';
    }

    res.json({ 
      status: "ok",
      smtpStatus: cachedSmtpStatus,
      firebaseConfigured: !!(firebaseConfig.projectId && firebaseConfig.apiKey),
      timestamp: new Date().toISOString()
    });
  });

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, body, attachmentData, attachmentName, isPdf, html } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      let attachments: any[] = [];
      if (attachmentData) {
        if (isPdf) {
          // attachmentData is expected to be base64 string without data:application/pdf;base64, prefix
          attachments.push({
            filename: attachmentName || 'Report.pdf',
            content: Buffer.from(attachmentData, 'base64'),
            contentType: 'application/pdf'
          });
        } else if (req.body.isImage || (attachmentName && /\.(png|jpg|jpeg|gif|webp)$/i.test(attachmentName))) {
          // Clean base64 if it has the prefix
          const base64Data = attachmentData.includes('base64,') 
            ? attachmentData.split('base64,')[1] 
            : attachmentData;
          attachments.push({
            filename: attachmentName || 'image.png',
            content: Buffer.from(base64Data, 'base64'),
            contentType: req.body.contentType || 'image/png',
            cid: 'news_image'
          });
        } else {
          attachments.push({
            filename: attachmentName || 'Schedule.txt',
            content: attachmentData
          });
        }
      }

      // Automatically attach the terms image if it exists in the public dir
      const isTeamMessage = req.body.isTeamMessage || false;
      const exts = ['.txt', '.png', '.jpg', '.jpeg', '.pdf'];
      for (const ext of exts) {
        if (isTeamMessage && ext === '.txt') {
          continue; // Skip terms.txt for team messages as default
        }
        const termsPath = path.join(process.cwd(), 'public', `terms${ext}`);
        const termsPath2 = path.join(process.cwd(), 'public', `Terms${ext}`); // Case sensitive
        if (fs.existsSync(termsPath)) {
          attachments.push({
            filename: `terms_and_conditions${ext}`,
            content: fs.readFileSync(termsPath),
            contentType: ext === '.pdf' ? 'application/pdf' : ext === '.txt' ? 'text/plain' : "image/" + ext.replace('.', '')
          });
          break; // Stop looking if we found one
        } else if (fs.existsSync(termsPath2)) {
          attachments.push({
            filename: `Terms_and_conditions${ext}`,
            content: fs.readFileSync(termsPath2),
            contentType: ext === '.pdf' ? 'application/pdf' : ext === '.txt' ? 'text/plain' : "image/" + ext.replace('.', '')
          });
          break; // Stop looking if we found one
        }
      }

      await sendEmailNotification(to, subject, body, attachments, html);
      res.json({ success: true, message: "Email sent successfully!" });
    } catch (error: any) {
      console.error("Full SMTP Error:", error);
      
      let message = "Failed to send email.";
      if (error.code === 'EAUTH') {
        message = "Authentication failed. Please verify your GMAIL_APP_PASSWORD and ensure 2FA is enabled.";
      } else if (error.code === 'ESOCKET') {
        message = "Connection error. Could not reach Gmail SMTP servers.";
      }
      
      res.status(500).json({ 
        error: message, 
        details: error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
    console.error("CRITICAL: Server failed to start:", err);
    process.exit(1);
});
