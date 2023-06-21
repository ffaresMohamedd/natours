const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true, // convert to lowercase but not a validator
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minLength: 8,
    // for security to we should not send password back to the client
    // so to never send back password to the client we use select: false
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // only works for create and save
      // if update is used it won't work
      validator: function (el) {
        return el === this.password;
      },
      message: "Passwords aren't the same!",
    },
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },
  passwordChangedAt: Date,
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailConfirmToken: String,
  emailConfirmTokenExpires: Number,
  emailConfirmed: {
    type: Boolean,
    default: false,
    select: false,
  },
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

userSchema.pre('save', async function (next) {
  // this refers to the current document(the current user)

  // only run this function if the password was modified
  if (!this.isModified('password')) return next();

  // hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // delete the passwordConfirm as we just needed it for validation but
  // not to persist it to the database
  this.passwordConfirm = undefined;

  // calling next to not to stop our mongoose middleware here
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  // we subtract 1 sec bec the saving into DB can take more time than creating the token
  // so this won't be accurate but it ensures that the token is generated
  // after the passwordChangedAt
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

// create instance on userSChema
// this method will be available on all documents of user
userSchema.methods.correctPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.passwordHasChanged = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedAt = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    // the greater timestamp the newest
    return jwtTimestamp < changedAt;
  }

  // user does not have passwordChangetAt
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  // generate random string
  const resetToken = crypto.randomBytes(32).toString('hex');
  // hash the str and save it into the DB and update the str with the hashed one
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  // set expire date after 10 minutes
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  // return the unhashed str to send it via email
  return resetToken;
};

userSchema.methods.createEmailConfirmtToken = function () {
  // generate random string
  const resetToken = crypto.randomBytes(32).toString('hex');
  // hash the str and save it into the DB and update the str with the hashed one
  this.emailConfirmToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  // set expire date after 10 minutes
  this.emailConfirmTokenExpires = Date.now() + 10 * 60 * 1000;
  // return the unhashed str to send it via email
  return resetToken;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
