const Sale = require('../models/Sale');
const Product = require('../models/Product');  // Make sure this exists
const Service = require('../models/Service');   // Add Service model
const mongoose = require('mongoose');

// Get sales summary report
const getSalesSummary = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    // Determine shop ID based on user role
    let shopId;
    if (req.user.role === 'developer') {
      shopId = req.query.shopId ? new mongoose.Types.ObjectId(req.query.shopId) : null;
    } else {
      // For non-developers, use their assigned shopId
      shopId = req.user.shopId ? new mongoose.Types.ObjectId(req.user.shopId) : null;
    }

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Base match condition with shop filter - Include completed and partially_returned sales for revenue
    const matchCondition = { 
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['completed', 'partially_returned'] }, // Include both completed and partially returned
      shopId: shopId
    };

    // Aggregate sales by day - calculate from items to account for returns
    const dailySalesAggregation = await Sale.aggregate([
      {
        $match: matchCondition
      },
      {
        $addFields: {
          // Create date field with just the date part for grouping
          saleDate: { 
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } 
          }
        }
      },
      {
        $unwind: {
          path: '$items',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          // Calculate effective quantity and revenue per item
          effectiveQuantity: {
            $subtract: [
              { $ifNull: ['$items.quantity', 0] },
              { $ifNull: ['$items.returnedQuantity', 0] }
            ]
          }
        }
      },
      {
        $addFields: {
          itemRevenue: {
            $multiply: ['$items.price', '$effectiveQuantity']
          }
        }
      },
      {
        $group: {
          _id: {
            saleId: '$_id',
            saleDate: '$saleDate'
          },
          totalRevenue: { $sum: '$itemRevenue' },
          itemCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.saleDate',
          productRevenue: { $sum: '$totalRevenue' },
          salesCount: { $sum: 1 },
          itemCount: { $sum: '$itemCount' }
        }
      },
      {
        $sort: { _id: 1 } // Sort by date
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          productRevenue: { $round: ["$productRevenue", 2] },
          salesCount: 1,
          itemCount: 1
        }
      }
    ]);

    // Get total sales within period - calculate from items for accuracy
    const totalStats = await Sale.aggregate([
      {
        $match: matchCondition
      },
      {
        $unwind: {
          path: '$items',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          effectiveQuantity: {
            $subtract: [
              { $ifNull: ['$items.quantity', 0] },
              { $ifNull: ['$items.returnedQuantity', 0] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$_id',
          subtotal: {
            $sum: {
              $multiply: ['$items.price', '$effectiveQuantity']
            }
          },
          tax: { $first: '$tax' },
          discount: { $first: '$discount' },
          returnedAmount: { $first: { $ifNull: ['$returnedAmount', 0] } }
        }
      },
      {
        $addFields: {
          total: {
            $add: [
              { $subtract: ['$subtotal', '$discount'] },
              '$tax'
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          subtotal: { $sum: '$subtotal' },
          tax: { $sum: '$tax' },
          discount: { $sum: '$discount' },
          returnedAmount: { $sum: '$returnedAmount' },
          totalSales: { $sum: 1 },
          totalItems: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          total: { $round: ['$total', 2] },
          subtotal: { $round: ['$subtotal', 2] },
          tax: { $round: ['$tax', 2] },
          discount: { $round: ['$discount', 2] },
          returnedAmount: { $round: ['$returnedAmount', 2] },
          totalSales: 1,
          totalItems: 1,
          averageSale: { 
            $round: [
              { $divide: [
                '$total', 
                { $cond: [{ $eq: ['$totalSales', 0] }, 1, '$totalSales'] }
              ] }, 
              2
            ] 
          }
        }
      }
    ]);

    // Get total services within period
    const serviceStats = await Service.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'completed',
          shopId: shopId
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" },
          discount: { $sum: "$discount" },
          totalServices: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" }
        }
      },
      {
        $project: {
          _id: 0,
          total: { $round: ["$total", 2] },
          discount: { $round: ["$discount", 2] },
          totalServices: 1,
          totalQuantity: 1,
          averageService: { $round: [{ $divide: ["$total", { $cond: [{ $eq: ["$totalServices", 0] }, 1, "$totalServices"] }] }, 2] }
        }
      }
    ]);

    // Aggregate services by day
    const dailyServicesAggregation = await Service.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'completed',
          shopId: shopId
        }
      },
      {
        $addFields: {
          saleDate: { 
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } 
          }
        }
      },
      {
        $group: {
          _id: "$saleDate",
          total: { $sum: "$total" },
          servicesCount: { $sum: 1 },
          serviceQuantity: { $sum: "$quantity" }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          total: { $round: ["$total", 2] },
          servicesCount: 1,
          serviceQuantity: 1
        }
      }
    ]);

    // Combine daily sales and services data
    const combinedDaily = {};
    
    // Add sales data
    dailySalesAggregation.forEach(day => {
      combinedDaily[day.date] = {
        date: day.date,
        productRevenue: day.productRevenue,  // Use the correct productRevenue field
        serviceRevenue: 0,
        totalRevenue: day.productRevenue,    // Start with just product revenue
        salesCount: day.salesCount,
        servicesCount: 0,
        itemCount: day.itemCount,
        serviceQuantity: 0
      };
    });

    // Add services data
    dailyServicesAggregation.forEach(day => {
      if (combinedDaily[day.date]) {
        combinedDaily[day.date].serviceRevenue = day.total;
        combinedDaily[day.date].totalRevenue = combinedDaily[day.date].productRevenue + day.total;
        combinedDaily[day.date].servicesCount = day.servicesCount;
        combinedDaily[day.date].serviceQuantity = day.serviceQuantity;
      } else {
        combinedDaily[day.date] = {
          date: day.date,
          productRevenue: 0,
          serviceRevenue: day.total,
          totalRevenue: day.total,
          salesCount: 0,
          servicesCount: day.servicesCount,
          itemCount: 0,
          serviceQuantity: day.serviceQuantity
        };
      }
    });

    // Convert to array and sort
    const combinedDailyArray = Object.values(combinedDaily).sort((a, b) => a.date.localeCompare(b.date));

    // Combine totals
    const salesTotals = totalStats[0] || { total: 0, subtotal: 0, tax: 0, discount: 0, totalSales: 0, totalItems: 0, averageSale: 0 };
    const servicesTotals = serviceStats[0] || { total: 0, discount: 0, totalServices: 0, totalQuantity: 0, averageService: 0 };

    const combinedTotals = {
      productRevenue: salesTotals.subtotal,  // Use subtotal for products only
      serviceRevenue: servicesTotals.total,
      totalRevenue: salesTotals.subtotal + servicesTotals.total,
      subtotal: salesTotals.subtotal,
      tax: salesTotals.tax,
      discount: salesTotals.discount + servicesTotals.discount,
      totalSales: salesTotals.totalSales,
      totalServices: servicesTotals.totalServices,
      totalTransactions: salesTotals.totalSales + servicesTotals.totalServices,
      totalItems: salesTotals.totalItems,
      totalServiceQuantity: servicesTotals.totalQuantity,
      averageSale: salesTotals.averageSale,
      averageService: servicesTotals.averageService
    };
    
    // Group by payment methods
    const paymentMethodStats = await Sale.aggregate([
      {
        $match: matchCondition
      },
      {
        $addFields: {
          netTotal: { $subtract: ["$total", { $ifNull: ["$returnedAmount", 0] }] }
        }
      },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$netTotal" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          method: "$_id",
          total: { $round: ["$total", 2] },
          count: 1
        }
      }
    ]);

    res.status(200).json({
      startDate: start,
      endDate: end,
      summary: combinedDailyArray,
      totals: combinedTotals,
      paymentMethods: paymentMethodStats
    });
  } catch (error) {
    console.error('Error generating sales summary:', error);
    res.status(500).json({ message: 'Server error generating report', error: error.message });
  }
};

// Get daily sales data with proper status filtering
const getDailySales = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 7 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    // Determine shop ID based on user role
    let shopId;
    if (req.user.role === 'developer') {
      shopId = req.query.shopId ? new mongoose.Types.ObjectId(req.query.shopId) : null;
    } else {
      // For non-developers, use their assigned shopId
      shopId = req.user.shopId ? new mongoose.Types.ObjectId(req.user.shopId) : null;
    }

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Base match condition with shop filter - include completed and partially_returned sales
    const matchCondition = { 
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['completed', 'partially_returned'] }, // Include both
      shopId: shopId
    };

    // Aggregate daily sales - calculate from items for accuracy
    const dailySales = await Sale.aggregate([
      {
        $match: matchCondition
      },
      {
        $addFields: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
        }
      },
      {
        $unwind: {
          path: '$items',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          effectiveQuantity: {
            $subtract: [
              { $ifNull: ['$items.quantity', 0] },
              { $ifNull: ['$items.returnedQuantity', 0] }
            ]
          }
        }
      },
      {
        $addFields: {
          itemRevenue: {
            $multiply: ['$items.price', '$effectiveQuantity']
          }
        }
      },
      {
        $group: {
          _id: {
            saleId: '$_id',
            day: '$day'
          },
          revenue: { $sum: '$itemRevenue' },
          items: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.day',
          revenue: { $sum: '$revenue' },
          transactions: { $sum: 1 },
          items: { $sum: '$items' }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          date: "$_id",
          revenue: { $round: ["$revenue", 2] },
          transactions: 1,
          items: 1,
          _id: 0
        }
      }
    ]);

    res.status(200).json(dailySales);
  } catch (error) {
    console.error('Error getting daily sales data:', error);
    res.status(500).json({ message: 'Server error getting daily sales', error: error.message });
  }
};

// Get product sales report
const getProductSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, categoryId, limit = 10 } = req.query;

    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);

    // Determine shop ID based on user role
    let shopId;
    if (req.user.role === 'developer') {
      shopId = req.query.shopId ? new mongoose.Types.ObjectId(req.query.shopId) : null;
    } else {
      // For non-developers, use their assigned shopId
      shopId = req.user.shopId ? new mongoose.Types.ObjectId(req.user.shopId) : null;
    }

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Base match condition with shop filter - include completed and partially_returned sales
    const matchCondition = { 
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['completed', 'partially_returned'] }, // Include both completed and partially returned
      shopId: shopId
    };

    // Add category filter if provided
    const categoryFilter = {};
    if (categoryId) {
      categoryFilter['product.category'] = new mongoose.Types.ObjectId(categoryId);
    }

    // Aggregate product sales
    const productSales = await Sale.aggregate([
      {
        $match: matchCondition
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo',
        }
      },
      {
        $unwind: {
          path: '$productInfo',
          preserveNullAndEmptyArrays: false // Skip items with no matching product
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'productInfo.category',
          foreignField: '_id',
          as: 'categoryInfo',
        }
      },
      {
        $unwind: {
          path: '$categoryInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      // Apply category filter if provided
      ...(categoryId ? [{ $match: categoryFilter }] : []),
      {
        $group: {
          _id: '$productInfo._id',
          name: { $first: '$productInfo.name' },
          category: { $first: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] } },
          // Net quantity sold (sold - returned)
          quantitySold: { $sum: { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }] } },
          totalRevenue: { $sum: { 
            $multiply: [
              '$items.price', 
              { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }] }
            ] 
          } },
          // Calculate profit based on sale item's costPrice (historical cost at time of sale) and net quantity
          profit: { 
            $sum: { 
              $multiply: [
                { $subtract: ['$items.price', { $ifNull: ['$items.costPrice', 0] }] },
                { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }] }
              ] 
            } 
          } 
        }
      },
      {
        $project: {
          _id: 0,
          name: 1,
          category: 1,
          quantitySold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          profit: { $round: ['$profit', 2] },
          profitMargin: { 
            $concat: [
              { 
                $toString: { 
                  $round: [
                    { 
                      $multiply: [
                        { 
                          $cond: [
                            { $eq: ['$totalRevenue', 0] },
                            0,
                            { $divide: ['$profit', '$totalRevenue'] }
                          ]
                        }, 
                        100
                      ] 
                    },
                    1,
                  ] 
                } 
              },
              '%'
            ]
          }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    // Return the array directly instead of wrapping in an object
    res.status(200).json(productSales);
  } catch (error) {
    console.error('Error generating product sales report:', error);
    res.status(500).json({ message: 'Server error generating report' });
  }
};

// Get profit distribution report
const getProfitDistribution = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);

    // Format for aggregation
    start.setHours(0, 0, 0, 0);

    // Base match condition with shop filter - include completed and partially_returned sales for profit calculation
    const matchCondition = { 
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['completed', 'partially_returned'] }, // Include both completed and partially returned
      shopId: new mongoose.Types.ObjectId(req.user.shopId._id)
    };

    // Define grouping based on groupBy parameter
    let dateFormat;
    if (groupBy === 'day') {
      dateFormat = '%Y-%m-%d';
    } else if (groupBy === 'week') {
      dateFormat = '%G-%V'; // ISO year and week
    } else if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    }

    // Aggregate profit data
    const profitDistribution = await Sale.aggregate([
      {
        $match: matchCondition
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo',
        }
      },
      {
        $unwind: {
          path: '$productInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          date: {
            $dateToString: { format: dateFormat, date: "$createdAt" } 
          },
          // Calculate effective quantity (total - returned)
          effectiveQuantity: {
            $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }]
          },
          itemCost: {
            $multiply: [
              { $ifNull: ['$items.costPrice', 0] },
              { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }] }
            ]
          },
          itemRevenue: {
            $multiply: [
              '$items.price', 
              { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }] }
            ]
          }
        }
      },
      {
        $group: {
          _id: "$date",
          total: { $sum: "$itemRevenue" },
          cost: { $sum: "$itemCost" },
          salesCount: { $sum: 1 },
        }
      },
      {
        $sort: { _id: 1 } // Sort by date
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          total: { $round: ["$total", 2] },
          cost: { $round: ["$cost", 2] },
          profit: { $round: [{ $subtract: ["$total", "$cost"] }, 2] },
          profitMargin: { 
            $concat: [
              { 
                $toString: { 
                  $round: [
                    { 
                      $multiply: [
                        { 
                          $cond: [
                            { $eq: ['$total', 0] },
                            0,
                            { $divide: [{ $subtract: ["$total", "$cost"] }, '$total'] }
                          ]
                        }, 
                        100
                      ] 
                    },
                    1,
                  ] 
                } 
              },
              '%'
            ]
          }
        }
      }
    ]);

    // Calculate overall totals
    const totalStats = await Sale.aggregate([
      {
        $match: matchCondition
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo',
        }
      },
      {
        $unwind: {
          path: '$productInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { 
            $multiply: [
              '$items.price', 
              { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }] }
            ] 
          } },
          cost: { $sum: { 
            $multiply: [
              { $ifNull: ['$items.costPrice', 0] }, 
              { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }] }
            ] 
          } },
          salesCount: { $sum: 1 },
        }
      },
      {
        $project: {
          _id: 0,
          total: { $round: ["$total", 2] },
          cost: { $round: ["$cost", 2] },
          profit: { $round: [{ $subtract: ["$total", "$cost"] }, 2] },
          profitMargin: { 
            $concat: [
              { 
                $toString: { 
                  $round: [
                    { 
                      $multiply: [
                        { 
                          $cond: [
                            { $eq: ['$total', 0] },
                            0,
                            { $divide: [{ $subtract: ["$total", "$cost"] }, '$total'] }
                          ]
                        }, 
                        100
                      ] 
                    },
                    1,
                  ] 
                } 
              },
              '%'
            ]
          }
        }
      }
    ]);

    res.status(200).json({
      startDate: start,
      endDate: end,
      summary: profitDistribution,
      totals: totalStats.length > 0 ? totalStats[0] : {
        total: 0,
        cost: 0,
        profit: 0,
        profitMargin: '0%'
      }
    });
  } catch (error) {
    console.error('Error generating profit distribution:', error);
    res.status(500).json({ message: 'Server error generating profit report', error: error.message });
  }
};

// Add new controller method for profit distribution report (detailed version)
const getProfitDistributionDetailed = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);

    // Format for aggregation
    start.setHours(0, 0, 0, 0);

    // Base match condition with shop filter - include completed and partially_returned sales for profit calculation
    const matchCondition = { 
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['completed', 'partially_returned'] }, // Include both completed and partially returned
      shopId: new mongoose.Types.ObjectId(req.user.shopId._id)
    };

    // Get the time grouping format based on the groupBy parameter
    let dateFormat;
    let dateGrouping;
    
    switch(groupBy) {
      case 'week':
        dateFormat = "%Y-%U"; // Year-Week format
        dateGrouping = { $week: "$createdAt" };
        break;
      case 'month':
        dateFormat = "%Y-%m"; // Year-Month format
        dateGrouping = { $month: "$createdAt" };
        break;
      case 'day':
      default:
        dateFormat = "%Y-%m-%d"; // Year-Month-Day format
        dateGrouping = { $dayOfMonth: "$createdAt" };
    }

    // Aggregate profit data by the specified time period
    const profitAggregation = await Sale.aggregate([
      {
        $match: matchCondition
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $unwind: {
          path: '$productInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          // Create date field for grouping
          periodDate: { 
            $dateToString: { format: dateFormat, date: "$createdAt" } 
          },
          // Calculate effective quantity (sold - returned)
          effectiveQuantity: {
            $subtract: ["$items.quantity", { $ifNull: ["$items.returnedQuantity", 0] }]
          },
          // Calculate item cost using sale item's costPrice (historical cost at time of sale)
          itemCost: {
            $multiply: [
              { $ifNull: ["$items.costPrice", 0] },
              { $subtract: ["$items.quantity", { $ifNull: ["$items.returnedQuantity", 0] }] }
            ]
          },
          // Calculate item revenue
          itemRevenue: {
            $multiply: [
              "$items.price", 
              { $subtract: ["$items.quantity", { $ifNull: ["$items.returnedQuantity", 0] }] }
            ]
          }
        }
      },
      {
        $group: {
          _id: "$periodDate",
          date: { $first: "$createdAt" }, // Keep a date for sorting and formatting
          total: { $sum: "$itemRevenue" },
          cost: { $sum: "$itemCost" },
          salesCount: { $sum: 1 }
        }
      },
      {
        $addFields: {
          profit: { $subtract: ["$total", "$cost"] },
          profitMargin: {
            $concat: [
              { 
                $toString: { 
                  $round: [
                    { 
                      $multiply: [
                        { 
                          $cond: [
                            { $eq: ["$total", 0] },
                            0,
                            { $divide: ["$profit", "$total"] }
                          ]
                        }, 
                        100
                      ] 
                    },
                    1
                  ] 
                } 
              },
              "%"
            ]
          }
        }
      },
      {
        $sort: { date: 1 } // Sort by date
      },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          total: { $round: ["$total", 2] },
          cost: { $round: ["$cost", 2] },
          profit: { $round: ["$profit", 2] },
          profitMargin: 1,
          salesCount: 1
        }
      }
    ]);

    // Get total profit statistics
    const totalStats = await Sale.aggregate([
      {
        $match: matchCondition
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $unwind: {
          path: '$productInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { 
            $multiply: [
              "$items.price", 
              { $subtract: ["$items.quantity", { $ifNull: ["$items.returnedQuantity", 0] }] }
            ] 
          } },
          cost: { $sum: { 
            $multiply: [
              { $ifNull: ["$items.costPrice", 0] }, 
              { $subtract: ["$items.quantity", { $ifNull: ["$items.returnedQuantity", 0] }] }
            ] 
          } },
          salesCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          total: { $round: ["$total", 2] },
          cost: { $round: ["$cost", 2] },
          profit: { $round: [{ $subtract: ["$total", "$cost"] }, 2] },
          salesCount: 1,
          profitMargin: {
            $concat: [
              { 
                $toString: { 
                  $round: [
                    { 
                      $multiply: [
                        { 
                          $cond: [
                            { $eq: ["$total", 0] },
                            0,
                            { $divide: [{ $subtract: ["$total", "$cost"] }, "$total"] }
                          ]
                        }, 
                        100
                      ] 
                    },
                    1
                  ] 
                } 
              },
              "%"
            ]
          }
        }
      }
    ]);

    res.status(200).json({
      startDate: start,
      endDate: end,
      summary: profitAggregation,
      totals: totalStats.length > 0 ? totalStats[0] : {
        total: 0,
        cost: 0,
        profit: 0,
        salesCount: 0,
        profitMargin: '0%'
      }
    });
  } catch (error) {
    console.error('Error generating profit distribution report:', error);
    res.status(500).json({ message: 'Server error generating profit report', error: error.message });
  }
};

// Add new method to get sales by status
const getSalesByStatus = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    // Base match condition with shop filter - include ALL sales to show status breakdown
    const matchCondition = { 
      createdAt: { $gte: start, $lte: end },
      shopId: new mongoose.Types.ObjectId(req.user.shopId._id)
    };

    // Aggregate sales by status
    const salesByStatus = await Sale.aggregate([
      {
        $match: matchCondition
      },
      {
        $addFields: {
          netAmount: { $subtract: ["$total", { $ifNull: ["$returnedAmount", 0] }] }
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$netAmount" },
          returnedAmount: { $sum: { $ifNull: ["$returnedAmount", 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          status: { $ifNull: ["$_id", "completed"] },
          count: 1,
          totalAmount: { $round: ["$totalAmount", 2] },
          returnedAmount: { $round: ["$returnedAmount", 2] }
        }
      }
    ]);

    res.status(200).json(salesByStatus);
  } catch (error) {
    console.error('Error getting sales by status:', error);
    res.status(500).json({ message: 'Server error getting sales by status', error: error.message });
  }
};

// Get inventory status report - make sure this function is correctly exported
const getInventoryStatusReport = async (req, res) => {
  try {
    const { lowStock, categoryId } = req.query;
    const shopId = req.query.shopId || req.user.shopId;

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Build filter condition
    const filter = { shopId: new mongoose.Types.ObjectId(shopId) };

    // Add category filter if provided
    if (categoryId) {
      filter.category = new mongoose.Types.ObjectId(categoryId);
    }

    // Add low stock filter if requested
    if (lowStock === 'true') {
      filter.$expr = { $lte: ["$quantity", "$reorderLevel"] };
    }

    const products = await Product.find(filter)
      .populate('category', 'name')
      .lean();

    // Transform products for the report
    const inventoryItems = products.map(product => ({
      name: product.name,
      category: product.category ? product.category.name : 'Uncategorized',
      quantity: product.quantity || 0,
      reorderLevel: product.reorderLevel || 10,
      value: ((product.cost || 0) * (product.quantity || 0)).toFixed(2),
      barcode: product.barcode || product.sku || ''
    }));

    // Calculate summary statistics
    const summary = {
      totalProducts: inventoryItems.length,
      totalItems: inventoryItems.reduce((sum, item) => sum + item.quantity, 0),
      totalValue: inventoryItems.reduce((sum, item) => sum + parseFloat(item.value), 0).toFixed(2),
      lowStockItems: inventoryItems.filter(item => item.quantity <= item.reorderLevel).length
    };

    res.status(200).json({
      inventory: inventoryItems,
      summary
    });
  } catch (error) {
    console.error('Error generating inventory status report:', error);
    res.status(500).json({ message: 'Server error generating report' });
  }
};

const generateSalesReport = async (req, res) => {
  // ...existing code...
};

module.exports = {
  getSalesSummary,
  getProductSalesReport,
  getInventoryStatusReport,
  generateSalesReport,
  getDailySales,
  getProfitDistribution,
  getProfitDistributionDetailed,
  getSalesByStatus
};