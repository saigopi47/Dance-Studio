// backend/routes/auth.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
// 🔑 CORRECTION: Import protect middleware from its dedicated file and remove the redundant internal definition.
const { protect } = require('../middleware/authMiddleware');


// --- Helper Function for JWT Token Generation ---
const generateToken = (id) => {
    // Use the secret from the .env file
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// --- Helper Function for Sending Email ---
const sendEmail = async ({ email, subject, html }) => {
    // 1. Create a transporter
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVICE_HOST,
        port: 465, // Use 465 for SSL/TLS
        secure: true, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        // Optional: Log errors during connection
        tls: {
            rejectUnauthorized: false
        }
    });

    // 2. Define email options
    const mailOptions = {
        from: `"Dance Studio" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: html,
    };

    // 3. Send the email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error: error.message };
    }
};

// --- AUTH ROUTES ---

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
    // ⚠️ IMPORTANT: In a real app, you must validate all input fields here.
    const { firstName, lastName, email, phone, gender, streetAddress1, streetAddress2, city, region, zipCode, country, danceType, startDate, startTime, comments, password } = req.body;

    try {
        // 1. Check if user already exists
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists.' });
        }

        // 2. Create new user
        const user = await User.create({
            firstName,
            lastName,
            email,
            phone,
            gender,
            streetAddress1,
            streetAddress2,
            city,
            region,
            zipCode,
            country,
            danceType,
            startDate,
            startTime,
            comments,
            password, // Password hashing is handled by pre('save') middleware in User model
        });

        if (user) {
            // 3. Respond with token and user details
            res.status(201).json({
                _id: user._id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data.' });
        }
    } catch (error) {
        // Log the error for debugging
        console.error("Register Error:", error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Find user by email
        const user = await User.findOne({ email });

        // 2. Check if user exists and password matches (using the method defined in the User model)
        if (user && (await user.matchPassword(password))) {
            // 3. Respond with token and user details
            res.json({
                _id: user._id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                token: generateToken(user._id),
                // Include progress for immediate UI needs (optional, but good for profile page load)
                progress: user.progress || {}
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});


// @desc    Request Password Reset Link (Email to user)
// @route   POST /api/auth/forgotpassword
// @access  Public
router.post('/forgotpassword', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            // Return a generic success message even if user isn't found to prevent email enumeration
            return res.json({ message: 'If that email is registered, a password reset link has been sent.' });
        }

        // Generate token and set expiry
        const resetToken = user.getResetPasswordToken();

        // Set expiry to 10 minutes (600,000 milliseconds)
        user.resetPasswordExpire = Date.now() + 600000;

        // Save the token hash and expiry to the database
        await user.save();

        // The URL the user clicks in the email
        // **IMPORTANT: You must replace 'http://localhost:3000' with your actual frontend URL.**
        const resetUrl = `http://localhost:5000/resetpassword.html?token=${resetToken}`;

        const html = `
            <h1>Password Reset Request</h1>
            <p>You have requested a password reset for your DanceAura account. Please click the link below to reset your password:</p>
            <a href="${resetUrl}" clicktracking=off>${resetUrl}</a>
            <p>This link will expire in 10 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
        `;

        const emailResult = await sendEmail({
            email: user.email,
            subject: 'DanceAura Password Reset Request',
            html: html,
        });

        if (emailResult.success) {
            res.json({ message: 'If that email is registered, a password reset link has been sent.' });
        } else {
            // Log the error but still return a success message if possible to prevent email enumeration
            console.error("Failed to send reset email:", emailResult.error);
            res.status(500).json({ message: 'Error sending reset email. Please try again later.' });
        }

    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ message: 'Server error during password reset request.' });
    }
});

// @desc    Reset Password (via token in URL)
// @route   POST /api/auth/resetpassword/:resetToken
// @access  Public
router.post('/resetpassword/:resetToken', async (req, res) => {
    // 1. Get the raw token from the URL parameter
    const rawToken = req.params.resetToken;

    // 2. Hash the raw token for database comparison
    const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

    const { password } = req.body;

    try {
        // 3. Find user by hashed token AND ensure it's not expired
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }, // Check if expiry date is greater than current time
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token.' });
        }

        // 4. Update the password
        user.password = password;
        // Clear the token fields after successful reset
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save(); // Password hashing middleware runs before save

        res.json({ message: 'Password reset successful. You can now log in.' });

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: 'Server error during password reset.' });
    }
});

// =======================================================================
// PROGRESS TRACKING & FETCHING ROUTES (New Feature Implementation)
// =======================================================================

// @desc    Track a video view for progress
// @route   POST /api/auth/trackprogress
// @access  Private (Requires JWT token in Authorization header)
router.post('/trackprogress', protect, async (req, res) => {
    const { danceStyle, level, videoId } = req.body;

    // Basic validation
    if (!danceStyle || !level || !videoId) {
        return res.status(400).json({ message: 'Missing required fields: danceStyle, level, or videoId.' });
    }

    try {
        const user = req.user;

        // Standardize keys
        const styleKey = danceStyle.trim();
        const levelKey = level.trim();
        const videoKey = videoId.trim();

        // 1. Initialize progress path if it doesn't exist
        if (!user.progress) {
            user.progress = {};
        }
        if (!user.progress[styleKey]) {
            user.progress[styleKey] = {};
        }
        if (!user.progress[styleKey][levelKey]) {
            user.progress[styleKey][levelKey] = [];
        }

        // 2. Check if the videoId is already tracked
        const completedVideos = user.progress[styleKey][levelKey];
        let isNewVideo = false;

        if (!completedVideos.includes(videoKey)) {
            // Add the new video ID
            completedVideos.push(videoKey);
            isNewVideo = true;

            // 3. Notify Mongoose of the change in the Mixed type field
            user.markModified('progress');
            await user.save();

            console.log(`Progress tracked for User: ${user.email}, Style: ${styleKey}, Level: ${levelKey}, Video: ${videoKey}`);
        }

        // Return the updated progress data
        res.json({
            message: isNewVideo ? 'Progress updated successfully.' : 'Video already tracked. No update needed.',
            updatedVideosCount: completedVideos.length,
            progress: user.progress // Return the full progress object
        });

    } catch (error) {
        console.error('Track Progress Error:', error);
        res.status(500).json({ message: 'Server error updating progress.' });
    }
});

// @desc    Get the logged-in user's profile and progress
// @route   GET /api/auth/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
    try {
        const user = req.user; // User object from 'protect' middleware

        // Prepare the response data
        const profileData = {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            danceType: user.danceType,
            startDate: user.startDate,
            isPaid: user.isPaid,
            progress: user.progress || {} // Send the progress object to the frontend
        };

        res.json(profileData);

    } catch (error) {
        console.error('Fetch Profile Error:', error);
        res.status(500).json({ message: 'Server error fetching profile data.' });
    }
});

// @desc    Get user progress data
// @route   GET /api/auth/progress
// @access  Private
router.get('/progress', protect, async (req, res) => {
    try {
        const user = req.user;

        // Return the progress object
        res.json({
            progress: user.progress || {},
            message: 'Progress data fetched successfully'
        });

    } catch (error) {
        console.error('Get Progress Error:', error);
        res.status(500).json({ message: 'Server error fetching progress data.' });
    }
});

module.exports = router;