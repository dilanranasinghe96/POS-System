const User = require('../models/User');
const Shop = require('../models/Shop');
const Sale = require('../models/Sale'); // Add Sale model for additional stats
const Service = require('../models/Service'); // Add Service model for service revenue

// Get developer dashboard stats
exports.getDeveloperStats = async (req, res) => {
  try {
    // Ensure user is a developer
    if (req.user.role !== 'developer') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get total shops count
    const totalShops = await Shop.countDocuments();
    const activeShops = await Shop.countDocuments({ active: true });
    const inactiveShops = await Shop.countDocuments({ active: false });

    // Get total users count
    const totalUsers = await User.countDocuments();

    // Get users by role
    const usersByRole = {
      developer: await User.countDocuments({ role: 'developer' }),
      admin: await User.countDocuments({ role: 'admin' }),
      manager: await User.countDocuments({ role: 'manager' }),
      cashier: await User.countDocuments({ role: 'cashier' })
    };

    // Get total sales for basic stats - only completed and partially_returned sales for revenue
    const totalSales = await Sale.countDocuments({ status: { $in: ['completed', 'partially_returned'] } });
    const totalRevenue = await Sale.aggregate([
      { $match: { status: { $in: ['completed', 'partially_returned'] } } },
      { 
        $group: { 
          _id: null, 
          total: { $sum: "$total" },
          returned: { $sum: { $ifNull: ["$returnedAmount", 0] } }
        } 
      },
      {
        $project: {
          netRevenue: { $subtract: ["$total", "$returned"] }
        }
      }
    ]);

    // Get total services for basic stats - only completed services for revenue
    const totalServices = await Service.countDocuments({ status: 'completed' });
    const totalServiceRevenue = await Service.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);

    const productRevenue = totalRevenue.length > 0 ? totalRevenue[0].netRevenue : 0;
    const serviceRevenue = totalServiceRevenue.length > 0 ? totalServiceRevenue[0].total : 0;

    res.json({
      totalShops,
      activeShops,
      inactiveShops,
      totalUsers,
      usersByRole,
      totalSales,
      totalServices,
      totalRevenue: productRevenue + serviceRevenue,
      productRevenue,
      serviceRevenue
    });
  } catch (error) {
    console.error('Error getting developer stats:', error);
    res.status(500).json({ message: 'Server error getting stats' });
  }
};

// Add a method for shop-specific stats that might be useful later
exports.getShopStats = async (req, res) => {
  try {
    const { shopId, startDate, endDate } = req.query;
    
    // Verify user has access to this shop
    if (req.user.role !== 'developer' && 
        (!req.user.shopId || req.user.shopId.toString() !== shopId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const dateFilter = {
      createdAt: { $gte: start, $lte: end },
      shopId: shopId,
      status: { $in: ['completed', 'partially_returned'] }
    };

    // Get sales stats with returns accounted for
    const salesStats = await Sale.aggregate([
      { $match: dateFilter },
      {
        $addFields: {
          netTotal: { $subtract: ["$total", { $ifNull: ["$returnedAmount", 0] }] }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: "$netTotal" },
          totalReturned: { $sum: { $ifNull: ["$returnedAmount", 0] } },
          averageSale: { $avg: "$netTotal" }
        }
      }
    ]);

    // Get service stats
    const serviceStats = await Service.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalServices: { $sum: 1 },
          totalRevenue: { $sum: "$total" },
          averageService: { $avg: "$total" }
        }
      }
    ]);

    const sales = salesStats[0] || { totalSales: 0, totalRevenue: 0, averageSale: 0 };
    const services = serviceStats[0] || { totalServices: 0, totalRevenue: 0, averageService: 0 };

    res.json({
      period: { startDate: start, endDate: end },
      sales: {
        count: sales.totalSales,
        revenue: sales.totalRevenue,
        average: sales.averageSale
      },
      services: {
        count: services.totalServices,
        revenue: services.totalRevenue,
        average: services.averageService
      },
      totals: {
        revenue: sales.totalRevenue + services.totalRevenue,
        transactions: sales.totalSales + services.totalServices
      }
    });
  } catch (error) {
    console.error('Error getting shop stats:', error);
    res.status(500).json({ message: 'Server error getting shop stats' });
  }
};