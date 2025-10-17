const User = require('../models/User');
const Shop = require('../models/Shop');

// Get all users (filtered by user access)
const getAllUsers = async (req, res) => {
  try {
    let users;
    
    // If developer, they can see all users or filter by shop
    if (req.user.role === 'developer') {
      const filter = {};
      if (req.query.shopId) {
        filter.shopId = req.query.shopId;
      }
      users = await User.find(filter)
        .select('-password')
        .populate('shopId', 'name address phone email')  // Fully populate shop fields
        .populate('createdBy', 'name username');
    } else {
      // Non-developers can only see users from their own shop
      users = await User.find({ shopId: req.user.shopId })
        .select('-password')
        .populate('shopId', 'name address phone email')  // Fully populate shop fields
        .populate('createdBy', 'name username');
    }
    
    // Transform the user data to ensure consistent shop representation
    const transformedUsers = users.map(user => {
      const userData = user.toObject();
      
      // Add shop property for frontend compatibility
      if (userData.shopId) {
        userData.shop = {
          _id: userData.shopId._id,
          name: userData.shopId.name,
          address: userData.shopId.address,
          phone: userData.shopId.phone,
          email: userData.shopId.email
        };
      }
      
      return userData;
    });
    
    res.status(200).json(transformedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('shopId', 'name')
      .populate('createdBy', 'name username');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if requester has access to this user
    if (req.user.role !== 'developer') {
      // Non-developers can only view users from their own shop
      if (!req.user.shopId || !user.shopId || req.user.shopId.toString() !== user.shopId.toString()) {
        return res.status(403).json({ message: 'Not authorized to access this user' });
      }
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error fetching user' });
  }
};

// Create user
const createUser = async (req, res) => {
  try {
    const { name, username, email, password, role, shopId } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'User with this username or email already exists' });
    }
    
    // Validate role permissions
    if (req.user.role !== 'developer') {
      // Non-developers can only create users for their own shop
      if (!req.user.shopId || (shopId && req.user.shopId.toString() !== shopId)) {
        return res.status(403).json({ message: 'You can only create users for your own shop' });
      }
      
      // Non-developers can't create developer accounts
      if (role === 'developer') {
        return res.status(403).json({ message: 'You do not have permission to create developer accounts' });
      }
      
      // Shop admins can only create manager or cashier accounts
      if (req.user.role === 'admin' && role === 'admin') {
        return res.status(403).json({ message: 'You do not have permission to create admin accounts' });
      }
    }
    
    // Determine shop assignment
    let assignedShopId = null;
    
    if (shopId) {
      // Verify the shop exists
      const shop = await Shop.findById(shopId);
      if (!shop) {
        return res.status(404).json({ message: 'Shop not found' });
      }
      assignedShopId = shopId;
    } else if (req.user.role !== 'developer' && req.user.shopId) {
      // Non-developers creating users assign them to their own shop
      assignedShopId = req.user.shopId;
    }
    
    const user = await User.create({
      name,
      username,
      email,
      password,
      role: role || 'cashier',
      shopId: assignedShopId,
      createdBy: req.user._id
    });
    
    const userData = user.toObject();
    delete userData.password;
    
    // Populate references for response
    const populatedUser = await User.findById(user._id)
      .select('-password')
      .populate('shopId', 'name')
      .populate('createdBy', 'name username');
    
    res.status(201).json(populatedUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error creating user' });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { name, username, email, role, password, shopId } = req.body;
    const userId = req.params.id;
    
    // Find the user to update
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if requester has permission to update this user
    if (req.user.role !== 'developer') {
      // Non-developers can only update users from their own shop
      if (!req.user.shopId || !user.shopId) {
        return res.status(403).json({ message: 'Shop information missing' });
      }
      
      // Handle populated shopId (from auth middleware) vs non-populated shopId
      const currentUserShopId = req.user.shopId._id ? req.user.shopId._id.toString() : req.user.shopId.toString();
      const targetUserShopId = user.shopId.toString();
      
      if (currentUserShopId !== targetUserShopId) {
        return res.status(403).json({ message: 'Not authorized to update this user' });
      }
      
      // Only developers can update a user's shop
      if (shopId && shopId !== user.shopId.toString()) {
        return res.status(403).json({ message: 'You do not have permission to change a user\'s shop' });
      }
      
      // Non-developers can't change roles to developer
      if (role === 'developer') {
        return res.status(403).json({ message: 'You do not have permission to create developer accounts' });
      }
      
      // Shop admins can't promote users to admin
      if (req.user.role === 'admin' && role === 'admin' && user.role !== 'admin') {
        return res.status(403).json({ message: 'You do not have permission to create admin accounts' });
      }
    }
    
    // Check if username or email is already taken by another user
    if (username || email) {
      const existingUser = await User.findOne({
        _id: { $ne: userId },
        $or: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email }] : [])
        ]
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Username or email is already taken' });
      }
    }
    
    // Build update object with only provided fields
    const updateData = {};
    if (name) updateData.name = name;
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) updateData.password = password;
    if (shopId && req.user.role === 'developer') {
      // Verify shop exists
      const shop = await Shop.findById(shopId);
      if (!shop) {
        return res.status(404).json({ message: 'Shop not found' });
      }
      updateData.shopId = shopId;
    }
    updateData.updatedAt = new Date();
    
    // For password updates, use save method to trigger password hash middleware
    if (password) {
      Object.assign(user, updateData);
      await user.save();
    } else {
      // Otherwise, use findByIdAndUpdate
      await User.findByIdAndUpdate(userId, updateData, { runValidators: true });
    }
    
    // Get updated user
    const updatedUser = await User.findById(userId)
      .select('-password')
      .populate('shopId', 'name')
      .populate('createdBy', 'name username');
    
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
};

// Toggle user active status
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check permissions
    if (req.user.role !== 'developer') {
      // Non-developers can only manage users from their own shop
      if (!req.user.shopId || !user.shopId) {
        return res.status(403).json({ message: 'Shop information missing' });
      }
      
      // Handle populated shopId (from auth middleware) vs non-populated shopId
      const currentUserShopId = req.user.shopId._id ? req.user.shopId._id.toString() : req.user.shopId.toString();
      const targetUserShopId = user.shopId.toString();
      
      if (currentUserShopId !== targetUserShopId) {
        return res.status(403).json({ message: 'Not authorized to manage this user' });
      }
      
      // Can't deactivate users with higher role
      if (
        (req.user.role === 'admin' && user.role === 'developer') || 
        (req.user.role === 'manager' && ['admin', 'developer'].includes(user.role))
      ) {
        return res.status(403).json({ message: 'Cannot modify status of users with higher role' });
      }
    }
    
    // Don't allow deactivating yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }
    
    // Toggle status
    user.active = !user.active;
    user.updatedAt = new Date();
    await user.save();
    
    const userData = user.toObject();
    delete userData.password;
    
    res.status(200).json(userData);
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({ message: 'Server error updating user status' });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check permissions
    if (req.user.role !== 'developer') {
      // Non-developers can only delete users from their own shop
      if (!req.user.shopId || !user.shopId) {
        return res.status(403).json({ message: 'Shop information missing' });
      }
      
      // Handle populated shopId (from auth middleware) vs non-populated shopId
      // req.user.shopId is populated (has _id property), user.shopId is not
      const currentUserShopId = req.user.shopId._id ? req.user.shopId._id.toString() : req.user.shopId.toString();
      const targetUserShopId = user.shopId.toString();
      
      console.log('Delete user permission check:', {
        currentUserRole: req.user.role,
        currentUserShopId: currentUserShopId,
        targetUserShopId: targetUserShopId,
        targetUserRole: user.role,
        shopIdMatch: currentUserShopId === targetUserShopId
      });
      
      if (currentUserShopId !== targetUserShopId) {
        return res.status(403).json({ message: 'Not authorized to delete this user - different shop' });
      }
      
      // Can't delete users with higher role
      if (
        (req.user.role === 'admin' && user.role === 'developer') || 
        (req.user.role === 'manager' && ['admin', 'developer'].includes(user.role))
      ) {
        return res.status(403).json({ message: 'Cannot delete users with higher role' });
      }
    }
    
    // Don't allow deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser
};
