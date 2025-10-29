// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // <-- Required for token generation

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    gender: { type: String },
    streetAddress1: { type: String, required: true },
    streetAddress2: { type: String },
    city: { type: String, required: true },
    region: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    danceType: { type: String, required: true },
    startDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    comments: { type: String },
    password: { type: String, required: true }, 
    isPaid: { type: Boolean, default: false }, 
    
    // --- PASSWORD RESET FIELDS ---\
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },

    // 🚨 NEW FIELD FOR STUDENT PROGRESS TRACKING 🚨
    // Stores completed video IDs: {'Ballet': {'Beginner': ['ballet_vid_1', 'ballet_vid_2']}}
    progress: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
    
}, { timestamps: true });

// Middleware to hash the password before saving a new user
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        // Salt rounds: 10 is standard
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare login password with hashed password
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Method for password reset token
// Generates a token, hashes it for database storage, and returns the unhashed token for the email.
userSchema.methods.getResetPasswordToken = function() {
    // 1. Generate a raw, cryptographically secure token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // 2. Hash the raw token (using sha256) and store the HASHED version in the database.
    // The raw token is sent to the user, the hashed token is stored for secure comparison.
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // 3. Set the expiry date in auth.js before calling user.save()
    // 4. Return the UNHASHED token to the calling function (auth.js) to be sent in the email link
    return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;