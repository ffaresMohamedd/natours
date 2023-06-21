const express = require('express');

const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
///////////////////

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);
router.patch('/confirmEmail/:token', authController.confirmEmail);
router.post('/reActivateAccount', authController.reActivateAccount);

// Protect all routes after this middleware
router.use(authController.protect);

router.patch('/updatePassword', authController.updatePassword);
// photo is the name of the field in the form that holds the data we want to upload(image)
router.patch(
  '/updateProfileInfo',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  authController.updateProfileInfo
);
router.delete('/deleteAccount', authController.deleteAccount);
router.get('/me', userController.getMe, userController.getUser);

router.route('/logout').get(authController.logout);
// Only admin can use the following routes after this middleware
router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);
router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
