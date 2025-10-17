import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from 'chart.js';
import React, { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Container,
  ProgressBar,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';
import {
  BoxSeam,
  Cart,
  CurrencyDollar,
  Tools
} from 'react-bootstrap-icons';
import { Line } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { productsApi, reportsApi, servicesApi, statsApi } from '../services/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  BarElement
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, getCurrentShop } = useAuth();
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any>({ 
    summary: [], 
    totals: {
      totalRevenue: 0,
      productRevenue: 0,
      serviceRevenue: 0,
      subtotal: 0,
      tax: 0,
      discount: 0,
      totalSales: 0,
      totalServices: 0,
      totalTransactions: 0,
      totalItems: 0,
      averageSale: 0
    } 
  });
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [todaySales, setTodaySales] = useState<any>({
    productRevenue: 0,
    serviceRevenue: 0,
    totalRevenue: 0,
    transactions: 0,
    items: 0
  });
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        const currentShop = getCurrentShop();
        if (!currentShop) {
          showError('No shop assigned to your account');
          return;
        }
        
        // Get dates for the last 7 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 6); // Last 7 days
        
        // Get today's date
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Format dates for API
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // Prepare API parameters
        const apiParams = {
          startDate: startDateStr,
          endDate: endDateStr,
          ...(user?.role === 'developer' && { shopId: currentShop._id })
        };
        
        const todayParams = {
          startDate: todayStr,
          endDate: todayStr,
          ...(user?.role === 'developer' && { shopId: currentShop._id })
        };
        
        // Fetch sales summary data
        const salesResponse = await reportsApi.getSalesSummary(apiParams);
        
        // Fetch daily sales data
        const dailyResponse = await reportsApi.getDailySales(apiParams);
        
        if (Array.isArray(dailyResponse.data)) {
          setDailySales(dailyResponse.data);
        } else {
          console.warn('Daily sales data is not an array:', dailyResponse.data);
          setDailySales([]);
        }
        
        // Fetch today's sales data
        const todayResponse = await reportsApi.getDailySales(todayParams);
        
        // Fetch today's service stats
        const todayServiceResponse = await servicesApi.getStats(todayParams);
        
        // Process today's sales and service data
        let todayProductRevenue = 0;
        let todayServiceRevenue = 0;
        let todaySalesTransactions = 0; // Only sales transactions
        let todayServiceTransactions = 0; // Only service transactions
        let todayItems = 0;
        
        if (Array.isArray(todayResponse.data) && todayResponse.data.length > 0) {
          const todayData = todayResponse.data[0];
          todayProductRevenue = todayData.revenue || 0;
          todaySalesTransactions = todayData.transactions || 0;
          todayItems = todayData.items || 0;
        }
        
        if (todayServiceResponse.data?.stats) {
          todayServiceRevenue = todayServiceResponse.data.stats.totalRevenue || 0;
          todayServiceTransactions = todayServiceResponse.data.stats.totalServices || 0;
        }
        
        setTodaySales({
          productRevenue: todayProductRevenue,
          serviceRevenue: todayServiceRevenue,
          totalRevenue: todayProductRevenue + todayServiceRevenue,
          transactions: todaySalesTransactions, // Only sales transactions
          items: todayItems
        });
        
        // Process sales data
        const salesResponseData = salesResponse.data || {};
        setSalesData({
          summary: Array.isArray(salesResponseData.summary) ? salesResponseData.summary : [],
          totals: salesResponseData.totals || {
            totalRevenue: 0,
            productRevenue: 0,
            serviceRevenue: 0,
            subtotal: 0,
            tax: 0,
            discount: 0,
            totalSales: 0,
            totalServices: 0,
            totalTransactions: 0,
            totalItems: 0,
            averageSale: 0
          }
        });
        
        // Fetch low stock products
        const lowStockParams = { 
          limit: 100,
          ...(user?.role === 'developer' && { shopId: currentShop._id })
        };
        
        const lowStockResponse = await productsApi.getAll(lowStockParams);
        
        // Filter products with low stock
        const lowStockData = lowStockResponse.data?.products?.filter(
          (product: any) => {
            // Use product's specific threshold if available, stored as reorderLevel in database
            const threshold = product.reorderLevel !== undefined ? 
              product.reorderLevel : 
              ((currentShop as any).settings?.defaultLowStockThreshold || 10);
            
            return product.quantity <= threshold;
          }
        ).slice(0, 5) || [];
        
        setLowStockProducts(Array.isArray(lowStockData) ? 
          lowStockData.map(product => ({
            id: product._id,
            name: product.name,
            category: product.category?.name || 'Uncategorized',
            stock: product.quantity,
            stockThreshold: product.reorderLevel || 
              ((currentShop as any).settings?.defaultLowStockThreshold || 10),
          })) : []);
        
        // Fetch top selling products
        const topProductsResponse = await reportsApi.getProductSalesReport({
          ...apiParams,
          limit: 5
        });
        
        const topProductsData = topProductsResponse.data?.products || [];
        if (Array.isArray(topProductsData)) {
          // Map the data to match our expected structure
          setTopProducts(topProductsData.slice(0, 5).map(product => ({
            id: product._id,
            name: product.productName || 'Unknown Product',
            quantitySold: product.totalQuantity || 0,
            revenue: product.totalRevenue || 0
          })));
        } else {
          console.warn('Top products data is not an array');
          setTopProducts([]);
        }
      } catch (err: any) {
        console.error('Failed to fetch dashboard data:', err);
        showError('Failed to load dashboard data. ' + (err.message || 'Please try again later.'));
        // Set empty default values to prevent map errors
        setSalesData({ summary: [], totals: {
          total: 0,
          subtotal: 0,
          tax: 0,
          discount: 0,
          totalSales: 0,
          totalItems: 0,
          averageSale: 0
        } });
        setLowStockProducts([]);
        setTopProducts([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [getCurrentShop, user?.role, showError]);
  
  // Prepare data for sales chart
  const salesChartData = {
    labels: dailySales.map(day => {
      const date = new Date(day.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Product Revenue',
        data: dailySales.map(day => day.productRevenue || day.revenue || 0),
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13, 110, 253, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Service Revenue',
        data: dailySales.map(day => day.serviceRevenue || 0),
        borderColor: '#198754',
        backgroundColor: 'rgba(25, 135, 84, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Sales Transactions',
        data: dailySales.map(day => day.salesCount || day.transactions || 0),
        borderColor: '#fd7e14',
        backgroundColor: 'rgba(253, 126, 20, 0.1)',
        tension: 0.4,
        yAxisID: 'y1',
      }
    ],
  };
  
  // Options for sales chart with dual Y axis
  const salesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Revenue'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      y1: {
        beginAtZero: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Transactions'
        },
        grid: {
          display: false
        }
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0)'
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.dataset.label === 'Revenue' 
                ? `Rs. ${context.parsed.y}` 
                : context.parsed.y;
            }
            return label;
          }
        }
      }
    }
  };
  
  // Prepare data for product category chart
  const categoryChartData = {
    labels: topProducts.map(product => product.name),
    datasets: [
      {
        label: 'Units Sold',
        data: topProducts.map(product => product.quantitySold),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  return (
    <Container fluid className="dashboard-container py-4 px-3 px-md-4">
      <Row className="mb-4 align-items-center">
        <Col>
          <h4 className="fw-bold mb-0">Dashboard</h4>
          <p className="text-muted mb-0">Overview of your store performance</p>
        </Col>
        <Col xs="auto">
          <Button 
            variant="primary" 
            size="lg"
            className="d-flex align-items-center shadow-sm"
            onClick={() => navigate('/pos')}
          >
            <Cart className="me-2" /> New Sale
          </Button>
        </Col>
      </Row>
      
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Loading dashboard data...</p>
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <Row className="g-4 mb-4">
            {/* Today's Total Revenue */}
            <Col lg={3} md={6} sm={6} xs={12}>
              <Card className="h-100 shadow-sm border-0 stat-card">
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between">
                    <div>
                      <Card.Title as="h6" className="text-muted mb-1">Today's Total Revenue</Card.Title>
                      <h3 className="mb-0 fw-bold">Rs. {todaySales.totalRevenue.toLocaleString()}</h3>
                      <Badge bg="primary" className="mt-2">Today</Badge>
                    </div>
                    <div className="rounded-circle d-flex align-items-center justify-content-center stat-icon-bg primary-icon">
                      <CurrencyDollar size={22} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <small className="text-muted">
                      Products: Rs. {todaySales.productRevenue.toLocaleString()} | Services: Rs. {todaySales.serviceRevenue.toLocaleString()}
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Today's Product Revenue */}
            <Col lg={3} md={6} sm={6} xs={12}>
              <Card className="h-100 shadow-sm border-0 stat-card">
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between">
                    <div>
                      <Card.Title as="h6" className="text-muted mb-1">Product Revenue</Card.Title>
                      <h3 className="mb-0 fw-bold">Rs. {todaySales.productRevenue.toLocaleString()}</h3>
                      <Badge bg="info" className="mt-2">Products</Badge>
                    </div>
                    <div className="rounded-circle d-flex align-items-center justify-content-center stat-icon-bg info-icon">
                      <BoxSeam size={22} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <small className="text-muted">
                      {todaySales.items} items sold
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Today's Service Revenue */}
            <Col lg={3} md={6} sm={6} xs={12}>
              <Card className="h-100 shadow-sm border-0 stat-card">
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between">
                    <div>
                      <Card.Title as="h6" className="text-muted mb-1">Service Revenue</Card.Title>
                      <h3 className="mb-0 fw-bold">Rs. {todaySales.serviceRevenue.toLocaleString()}</h3>
                      <Badge bg="success" className="mt-2">Services</Badge>
                    </div>
                    <div className="rounded-circle d-flex align-items-center justify-content-center stat-icon-bg success-icon">
                      <Tools size={22} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <small className="text-muted">
                      Manual services
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Today's Transactions */}
            <Col lg={3} md={6} sm={6} xs={12}>
              <Card className="h-100 shadow-sm border-0 stat-card">
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between">
                    <div>
                      <Card.Title as="h6" className="text-muted mb-1">Today's Transactions</Card.Title>
                      <h3 className="mb-0 fw-bold">{todaySales.transactions}</h3>
                      <Badge bg="warning" className="mt-2">Today</Badge>
                    </div>
                    <div className="rounded-circle d-flex align-items-center justify-content-center stat-icon-bg warning-icon">
                      <Cart size={22} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <small className="text-muted">
                      Avg: Rs. {todaySales.transactions > 0 ? (todaySales.totalRevenue / todaySales.transactions).toLocaleString() : '0'} per transaction
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Revenue Summary Cards */}
          <Row className="g-4 mb-4">
            <Col lg={4} md={12}>
              <Card className="h-100 shadow-sm border-0">
                <Card.Body className="p-4">
                  <Card.Title as="h5" className="mb-3">Revenue Summary (Last 7 Days)</Card.Title>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted">Total Revenue</span>
                      <h4 className="mb-0 fw-bold">Rs. {salesData.totals.totalRevenue?.toLocaleString() || '0'}</h4>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted">Product Revenue</span>
                      <span className="fw-semibold">Rs. {salesData.totals.productRevenue?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted">Service Revenue</span>
                      <span className="fw-semibold">Rs. {salesData.totals.serviceRevenue?.toLocaleString() || '0'}</span>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted">Total Sales</span>
                      <span>{salesData.totals.totalSales || 0}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-muted">Total Services</span>
                      <span>{salesData.totals.totalServices || 0}</span>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            
            {/* Low Stock Items */}
            <Col lg={8} md={12}>
              <Card className="h-100 shadow-sm border-0 stat-card">
                <Card.Body className="p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <Card.Title as="h5" className="mb-0">Low Stock Alert</Card.Title>
                    <Badge bg="danger">
                      {lowStockProducts.length} items
                    </Badge>
                  </div>
                  
                  {lowStockProducts.length > 0 ? (
                    <div className="table-responsive">
                      <Table hover className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Product</th>
                            <th>Stock</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lowStockProducts.slice(0, 5).map((product) => (
                            <tr key={product.id}>
                              <td>{product.name}</td>
                              <td>{product.stock}</td>
                              <td>
                                <ProgressBar 
                                  now={product.stock / product.stockThreshold * 100} 
                                  variant={product.stock <= product.stockThreshold / 2 ? "danger" : "warning"}
                                  style={{ height: "8px" }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <p className="text-muted">No low stock products</p>
                    </div>
                  )}
                </Card.Body>
                <Card.Footer className="bg-white border-0 pt-0">
                  <Button 
                    variant="outline-primary" 
                    size="sm"
                    onClick={() => navigate('/products')}
                  >
                    View All Products
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
          </Row>
          
          {/* Charts */}
          <Row className="mb-4 g-4">
            {/* Revenue & Transaction Trend Chart */}
            <Col xs={12}>
              <Card className="h-100 shadow-sm border-0">
                <Card.Body className="p-4">
                  <Card.Title as="h5" className="mb-3">Revenue & Transaction Trends (Last 7 Days)</Card.Title>
                  
                  {dailySales.length > 0 ? (
                    <div style={{ height: '350px' }}>
                      <Line
                        data={salesChartData}
                        options={salesChartOptions}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <p className="text-muted">No sales data available for the selected period</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
          
          {/* Additional Dashboard Content */}
          <Row className="g-4">
            {/* Recent Sales Summary */}
            <Col lg={6} md={12}>
              <Card className="h-100 shadow-sm border-0">
                <Card.Body className="p-4">
                  <Card.Title as="h5" className="mb-3">Recent Sales Summary</Card.Title>
                  
                  {dailySales.length > 0 ? (
                    <div className="table-responsive">
                      <Table hover className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Date</th>
                            <th>Transactions</th>
                            <th>Product Revenue</th>
                            <th>Service Revenue</th>
                            <th>Total Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...dailySales]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .slice(0, 5)
                            .map((day, idx) => (
                              <tr key={idx}>
                                <td>{new Date(day.date).toLocaleDateString('en-US', { 
                                  weekday: 'short', month: 'short', day: 'numeric' 
                                })}</td>
                                <td>{(day.salesCount || 0) + (day.servicesCount || 0)}</td>
                                <td>Rs. {(day.productRevenue || day.revenue || 0).toLocaleString()}</td>
                                <td>Rs. {(day.serviceRevenue || 0).toLocaleString()}</td>
                                <td>Rs. {((day.productRevenue || day.revenue || 0) + (day.serviceRevenue || 0)).toLocaleString()}</td>
                              </tr>
                            ))}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <p className="text-muted">No recent sales data</p>
                    </div>
                  )}
                </Card.Body>
                <Card.Footer className="bg-white border-0 pt-0">
                  <Button 
                    variant="outline-primary" 
                    size="sm"
                    onClick={() => navigate('/sales')}
                  >
                    View All Sales
                  </Button>
                </Card.Footer>
              </Card>
            </Col>

            {/* Top Products */}
            <Col lg={6} md={12}>
              <Card className="h-100 shadow-sm border-0">
                <Card.Body className="p-4">
                  <Card.Title as="h5" className="mb-3">Top Selling Products</Card.Title>
                  
                  {topProducts.length > 0 ? (
                    <div className="table-responsive">
                      <Table hover className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Product</th>
                            <th>Sold</th>
                            <th>Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topProducts.map((product) => (
                            <tr key={product.id}>
                              <td>{product.name}</td>
                              <td>{product.totalSold}</td>
                              <td>Rs. {product.totalRevenue.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <p className="text-muted">No product sales data</p>
                    </div>
                  )}
                </Card.Body>
                <Card.Footer className="bg-white border-0 pt-0">
                  <Button 
                    variant="outline-primary" 
                    size="sm"
                    onClick={() => navigate('/reports')}
                  >
                    View Detailed Reports
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Add CSS for stat card icons */}
      <style>{`
        .dashboard-container {
          background-color: #f8f9fa;
          max-width: 100%;
          width: 100%;
        }
        
        .stat-card {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.15) !important;
        }
        
        .stat-icon-bg {
          width: 48px;
          height: 48px;
        }
        
        .primary-icon {
          background-color: rgba(13, 110, 253, 0.1);
          color: #0d6efd;
        }
        
        .success-icon {
          background-color: rgba(25, 135, 84, 0.1);
          color: #198754;
        }
        
        .warning-icon {
          background-color: rgba(255, 193, 7, 0.1);
          color: #ffc107;
        }
        
        .danger-icon {
          background-color: rgba(220, 53, 69, 0.1);
          color: #dc3545;
        }
        
        .info-icon {
          background-color: rgba(13, 202, 240, 0.1);
          color: #0dcaf0;
        }
      `}</style>
    </Container>
  );
};

export default Dashboard;