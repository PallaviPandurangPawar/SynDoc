const User = require('../models/User');

// GET /api/users/me
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile fetched successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        about: user.about || '',
        avatarData: user.avatarData || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// PUT /api/users/me
const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, address, about, avatarData } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Email is safe to change here — login looks up by email but every request
    // after that authenticates by the user's ID stored in the token, not the email.
    if (email !== undefined && email.trim() !== '') {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== user.email) {
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'That email is already in use by another account'
          });
        }
        user.email = normalizedEmail;
      }
    }

    // Only overwrite a field if the user actually typed something into it —
    // now that the form always starts blank, an empty field means "leave this alone",
    // not "clear this out".
    if (name !== undefined && name.trim() !== '') user.name = name.trim();
    if (phone !== undefined && phone.trim() !== '') user.phone = phone.trim();
    if (address !== undefined && address.trim() !== '') user.address = address.trim();
    if (about !== undefined && about.trim() !== '') user.about = about.trim();
    if (avatarData !== undefined && avatarData !== '') user.avatarData = avatarData;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        about: user.about || '',
        avatarData: user.avatarData || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = { getProfile, updateProfile };