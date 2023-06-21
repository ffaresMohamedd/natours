const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const sendEmail = require('../utils/email');
const { findByIdAndDelete } = require('../models/userModel');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createCookie = (res, token) => {
  const cookieOptions = {
    expire: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);
};

exports.signup = catchAsync(async (req, res, next) => {
  // check if user already exists
  const userExist = await User.findOne({ email: req.body.email }).select(
    '+emailConfirmed'
  );
  if (userExist) {
    // check if email is confirmed
    if (userExist.emailConfirmed === true)
      return next(new AppError('This email already exists', 400));
    // check if emailConfirmationToken is valid
    if (userExist.emailConfirmTokenExpires > Date.now())
      return next(
        new AppError(
          'Open the link that was sent to your Email to verify your Email',
          400
        )
      );
    // if email isnot confirmed and token is expired delete that user
    await User.findOneAndDelete({ email: req.body.email });
  }
  // save user data
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role === 'admin' ? 'user' : req.body.role,
  });
  // create token to be sent by email
  const token = newUser.createEmailConfirmtToken();
  await newUser.save({ validateModifiedOnly: true });

  // SEND the token to users's email
  const confirmEmailURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/confirmEmail/${token}`;

  const message = `<h1>open this url to confirm your email</h1> <a href="${confirmEmailURL}"> Click Here </a>`;

  const optionsObj = {
    email: newUser.email,
    subject: 'Your Email confirm token, valid for 10 minutes',
    message,
  };

  try {
    await sendEmail(optionsObj);

    res.status(200).json({
      status: 'success',
      message: 'Your email confirmation token has been sent to the email',
    });
  } catch (err) {
    // newUser.emailConfirmToken = undefined;
    // newUser.emailConfirmTokenExpires = undefined;
    // await newUser.save({ validateModifiedOnly: true });
    await User.findByIdAndDelete(newUser._id);
    return next(new AppError('There was an error sending the email', 500));
  }
});

exports.confirmEmail = catchAsync(async (req, res, next) => {
  // encrypt token sent by email
  let token = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  // find the user that has this token
  const user = await User.findOne({
    emailConfirmToken: token,
    emailConfirmTokenExpires: { $gt: Date.now() },
  }).select('+emailConfirmed');
  if (!user)
    return next(new AppError('Please signup again your token has expired'));
  // confirm user's email
  user.emailConfirmed = true;
  user.emailConfirmToken = undefined;
  user.emailConfirmTokenExpires = undefined;
  await user.save({ validateModifiedOnly: true });
  token = signToken(user._id);
  createCookie(res, token);
  res.status(200).json({
    state: 'success',
    message: 'Your email has been successfully confirmed',
    token,
  });
});

// exports.signup = catchAsync(async (req, res, next) => {
//   const newUser = await User.create({
//     name: req.body.name,
//     email: req.body.email,
//     password: req.body.password,
//     passwordConfirm: req.body.passwordConfirm,
//     passwordChangedAt: req.body.passwordChangedAt,
//     role: req.body.role === 'admin' ? 'user' : req.body.role,
//   });

//   // const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
//   //   expiresIn: process.env.JWT_EXPIRES_IN,
//   const token = signToken(newUser._id);

//   createCookie(res, token);

//   res.status(201).json({
//     status: 'success',
//     data: {
//       user: newUser,
//     },
//   });
// });

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // check if email and password exists
  if (!email || !password)
    return next(
      new AppError('Please provide us with your email and password', 400)
    );
  // check if user exist and password is correct
  // we need the password to check if it is the same but findOne won't find it because
  // we set select: false so we use select('+password)
  const user = await User.findOne({ email })
    .select('+password')
    .select('+emailConfirmed');

  if (!user || !(await user.correctPassword(password)))
    return next(new AppError('Incorrect email or password', 401));

  if (!user.emailConfirmed)
    return next(new AppError('Please confirm your email first'));

  // if everything is ok send token to client
  const token = signToken(user._id);

  createCookie(res, token);

  res.status(200).json({
    status: 'success',
    token,
  });
});

exports.logout = (req, res) => {
  createCookie(res, 'Logged out');
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // get token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  )
    token = req.headers.authorization.split(' ')[1];
  else if (req.cookies.jwt) token = req.cookies.jwt;

  if (!token)
    return next(new AppError("You aren't logged in, please login first", 401));
  // verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // check if the user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser)
    return next(new AppError('This user does no longer exist'), 401);

  // check if the user has chamged his password after the token was issued
  if (
    currentUser.passwordHasChanged(decoded.iat, currentUser.passwordChangedAt)
  )
    return next(
      new AppError('Your password has changed, please login again', 401)
    );

  req.user = currentUser;
  // Grant access to the protected route
  next();
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role))
      return next(
        new AppError("You don't have permission to perform this action", 403)
      );
    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // GET user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new AppError('There is no user with this email'), 404);

  // GENERATE the random reset token
  const resetToken = user.createPasswordResetToken();
  // to save the new added fields to the DB
  await user.save({ validateModifiedOnly: true });

  // SEND the token to users's email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password ? submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\n If you didn't forget your password please ignore this email`;

  const optionsObj = {
    email: user.email,
    subject: 'Your password reset token, valid for 10 minutes',
    message,
  };
  try {
    await sendEmail(optionsObj);

    res.status(200).json({
      status: 'success',
      message: 'Your reset token has been sent to the email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateModifiedOnly: true });
    return next(new AppError('There was an error sending the email', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // GET user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // IF token hasn't expired and there is user , set new password
  if (!user) return next(new AppError('Token is invalid or has expired'), 400);

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // UPDATE passwordChangedAt
  user.save({ validateModifiedOnly: true });
  // LOGIN the user, send jwt
  const token = signToken(user._id);

  createCookie(res, token);

  res.status(200).json({
    status: 'success',
    token,
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // find the user
  const user = await User.findById(req.user._id).select('+password');

  // check that the POSTed current password is correct
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;

  if (!(await user.correctPassword(currentPassword)))
    return next(new AppError('Incorrect password!', 401));

  if (currentPassword === newPassword)
    return next(
      new AppError(
        "Your new password can't be the same as your current password"
      )
    );
  // update the new password
  user.password = newPassword;
  user.passwordConfirm = newPasswordConfirm;

  await user.save({ validateModifiedOnly: true });
  // log the user, send jwt
  const token = signToken(user._id);

  createCookie(res, token);

  res.status(200).json({
    status: 'success',
    token,
  });
});

exports.updateProfileInfo = catchAsync(async (req, res, next) => {
  // find the user
  const user = await User.findById(req.user._id);

  // update the user info
  if (req.body.email) user.email = req.body.email;
  if (req.body.name) user.name = req.body.name;
  if (req.file) user.photo = req.file.filename;

  await user.save({ validateModifiedOnly: true });

  // remove unwanted fields before sending the user in res
  user.password = undefined;
  user.passwordChangedAt = undefined;

  // sending user in res
  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

exports.deleteAccount = catchAsync(async (req, res, next) => {
  if (!req.body.password) next(new AppError('Please enter your password', 401));
  const user = await User.findOne({ email: req.user.email }).select(
    '+password'
  );
  if (!(await user.correctPassword(req.body.password)))
    return next(new AppError('Incorrect password', 401));

  await User.findByIdAndUpdate(user._id, {
    $set: { active: false },
    emailConfirmed: false,
  });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.reActivateAccount = catchAsync(async (req, res, next) => {
  // update the account active to be true to be able to find the user
  await User.updateOne({ email: req.body.email }, { $set: { active: true } });
  // find the user
  const user = await User.findOne({ email: req.body.email })
    .select('+password')
    .select('+emailConfirmed');
  // check if password is correct if not make the acc inactive again
  if (!(await user.correctPassword(req.body.password))) {
    await User.updateOne(
      { email: req.body.email },
      { $set: { active: false } },
      { emailConfirmed: true }
    );
    return next(new AppError('Incorrect email or password'), 401);
  }
  // login the user
  const token = signToken(user._id);

  createCookie(res, token);

  res.status(200).json({
    status: 'success',
    message: 'Your Account reactivated successfully',
    data: {
      token,
    },
  });
});
