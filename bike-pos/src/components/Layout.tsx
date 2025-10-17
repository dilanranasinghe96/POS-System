import { useEffect, useState } from 'react';
import {
  Container,
  Dropdown,
  Nav,
  Navbar,
  Offcanvas
} from 'react-bootstrap';
import {
  BoxArrowRight,
  BoxSeam,
  Cart3,
  ClipboardData,
  Gear,
  PeopleFill,
  Receipt,
  Speedometer2,
  Tools
} from 'react-bootstrap-icons';
import { LinkContainer } from 'react-router-bootstrap';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

// Menu items configuration
const getMenuItems = (role: string) => {
  const items = [
    {
      category: 'Main',
      items: [
        {
          name: 'Dashboard',
          path: '/dashboard', 
          icon: <Speedometer2 size={18} />,
          roles: ['admin', 'cashier', 'manager'] // Added manager
        },
        {
          name: 'POS',
          path: '/pos',
          icon: <Cart3 size={18} />,
          roles: ['admin', 'cashier', 'manager'] // Added manager
        },
      ]
    },
    {
      category: 'Inventory',
      items: [
        {
          name: 'Products',
          path: '/products',
          icon: <BoxSeam size={18} />,
          roles: ['admin', 'manager'] // Only admin and manager
        },
        
        {
          name: 'Repair Jobs',
          path: '/repair-jobs',
          icon: <Gear size={18} />,
          roles: ['admin', 'manager', 'cashier'] // All roles can manage repair jobs
        },
      ]
    },
    {
      category: 'Sales',
      items: [
        {
          name: 'Sales History',
          path: '/sales',
          icon: <Receipt size={18} />,
          roles: ['admin', 'cashier', 'manager'] // Added manager
        },
        {
          name: 'Reports',
          path: '/reports',
          icon: <ClipboardData size={18} />,
          roles: ['admin', 'manager'] // Only admin and manager
        }
      ]
    }
  ];

  // Add developer-specific items
  if (role === 'developer') {
    items.unshift(
      {
        category: 'Developer',
        items: [
          {
            name: 'Developer Dashboard',
            path: '/developer/dashboard',
            icon: <Gear size={18} />,
            roles: ['developer']
          },
          {
            name: 'User Management',
            path: '/developer/users',
            icon: <PeopleFill size={18} />,
            roles: ['developer']
          }
        ]
      }
    );
  }

  // Filter items based on user role
  return items.map(category => ({
    ...category,
    items: category.items.filter(item => item.roles.includes(role))
  })).filter(category => category.items.length > 0);
};

const Layout = () => {
  const { user, logout, getCurrentShop } = useAuth();
  const { showSuccess } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [showOffcanvas, setShowOffcanvas] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const currentShop = getCurrentShop();

  // Check if mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 992);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle logout
  const handleLogout = () => {
    logout();
    showSuccess('Logged out successfully');
    navigate('/login');
  };

  // Close offcanvas after navigation
  const handleNavigation = () => {
    setShowOffcanvas(false);
  };

  // Get menu items based on user role
  const menuCategories = getMenuItems(user?.role || 'cashier');
  
  // Flatten menu items for simpler access when needed
  const flatMenuItems = menuCategories.flatMap(category => category.items);

  // Get current page title
  const getCurrentPageTitle = () => {
    const currentItem = flatMenuItems.find(item => item.path === location.pathname);
    return currentItem ? currentItem.name : 'Dashboard';
  };

  return (
    <div className="layout-container">
      {/* Enhanced Navbar */}
      <Navbar 
        bg="primary" 
        variant="dark" 
        expand="lg" 
        fixed="top" 
        className="shadow-sm py-2"
        style={{
          background: 'linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          zIndex: 1030
        }}
      >
        <Container fluid className="px-3 px-md-4">
          {/* Brand and Mobile Menu Toggle */}
          <div className="d-flex align-items-center">
            {isMobile && (
              <button
                className="btn btn-link text-white p-1 me-2 border-0"
                onClick={() => setShowOffcanvas(!showOffcanvas)}
                aria-label="Toggle navigation"
              >
                <div className="hamburger-icon">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </button>
            )}
            
            <LinkContainer to={user?.role === 'developer' ? '/developer/dashboard' : '/dashboard'}>
              <Navbar.Brand className="fw-bold fs-4 text-white d-flex align-items-center">
                
                <span className="d-none d-sm-inline">
                  {user?.role === 'developer' ? 'Bike Parts POS' : currentShop?.name || 'Bike Parts POS'}
                </span>
                <span className="d-sm-none">
                  {user?.role === 'developer' ? 'BikePOS' : currentShop?.name || 'BikePOS'}
                </span>
              </Navbar.Brand>
            </LinkContainer>
          </div>

             {/* Desktop Navigation */}
          {!isMobile && (
            <Nav className="mx-auto d-none d-lg-flex">
              {flatMenuItems.map((item) => {
                const isActive = location.pathname === item.path;
                
                return (
                  <LinkContainer key={item.name} to={item.path}>
                    <Nav.Link 
                      className={`nav-item-custom mx-1 px-3 py-2 rounded-pill transition-all ${
                        isActive ? 'active-nav-item' : ''
                      }`}
                    >
                      <span className="me-2">{item.icon}</span>
                      <span className="d-none d-xl-inline">{item.name}</span>
                    </Nav.Link>
                  </LinkContainer>
                );
              })}
            </Nav>
          )}

          {/* Right side controls */}
          <div className="d-flex align-items-center">
            {/* User Dropdown */}
            <Dropdown align="end">
              <Dropdown.Toggle variant="link" className="nav-link text-white border-0 d-flex align-items-center p-0">
                <div className="d-none d-md-block me-2 text-end">
                  <div className="fw-bold">{user?.name}</div>
                  <div className="small text-white-50">
                    <span className="text-capitalize">{user?.role}</span>
                    
                  </div>
                </div>
                  <BoxArrowRight size={20} />
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {user?.role === 'admin' && (
                  <>
                    <LinkContainer to="/admin/shop">
                      <Dropdown.Item>
                        <Gear size={16} className="me-2" />
                        Shop Settings
                      </Dropdown.Item>
                    </LinkContainer>
                    <LinkContainer to="/admin/users">
                      <Dropdown.Item>
                        <PeopleFill size={16} className="me-2" />
                        User Management
                      </Dropdown.Item>
                    </LinkContainer>
                    <Dropdown.Divider />
                  </>
                )}
                <Dropdown.Item onClick={handleLogout}>
                  <BoxArrowRight size={16} className="me-2" />
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown> 
          </div>
        </Container>
      </Navbar>

      {/* Mobile Navigation Offcanvas */}
      <Offcanvas
        show={showOffcanvas}
        onHide={() => setShowOffcanvas(false)}
        placement="start"
        className="sidebar-nav"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>
            {user?.role === 'developer' ? 'Bike Parts POS' : currentShop?.name || 'Bike Parts POS'}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Nav className="flex-column">
            {menuCategories.map((category, idx) => (
              <div key={idx} className="mb-3">
                <div className="sidebar-category">{category.category}</div>
                {category.items.map((item) => (
                  <LinkContainer key={item.name} to={item.path} onClick={handleNavigation}>
                    <Nav.Link className={`py-2 ${location.pathname === item.path ? 'active' : ''}`}>
                      <span className="me-3">{item.icon}</span>
                      {item.name}
                    </Nav.Link>
                  </LinkContainer>
                ))}
              </div>
            ))}
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Main Content */}
      <main className="main-content">
        <Container fluid className="h-100 py-4 px-3 px-md-4">
          <Outlet />
        </Container>
      </main>

      {/* Custom Styles */}
      <style>{`
        .layout-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .navbar {
          height: 60px;
        }

        .main-content {
          flex: 1;
          margin-top: 20px;
          background: #f8f9fa;
          min-height: calc(100vh - 60px);
          width: 100%;
          padding-bottom: 2rem;
        }

        .sidebar-nav {
          margin-top: 60px;
          width: 280px;
        }

        .hamburger-icon {
          width: 20px;
          height: 15px;
          position: relative;
          cursor: pointer;
        }
        
        .hamburger-icon span {
          display: block;
          position: absolute;
          height: 2px;
          width: 100%;
          background: white;
          border-radius: 1px;
          opacity: 1;
          left: 0;
          transform: rotate(0deg);
          transition: .25s ease-in-out;
        }
        
        .hamburger-icon span:nth-child(1) { top: 0px; }
        .hamburger-icon span:nth-child(2) { top: 6px; }
        .hamburger-icon span:nth-child(3) { top: 12px; }

        .nav-item-custom {
          color: rgba(255, 255, 255, 0.8) !important;
          transition: all 0.3s ease;
          border: 1px solid transparent;
        }

        .nav-item-custom:hover {
          color: white !important;
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .active-nav-item {
          color: white !important;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .user-dropdown:hover {
          opacity: 0.8;
        }

        .user-avatar {
          transition: all 0.3s ease;
        }

        .user-avatar:hover {
          transform: scale(1.05);
        }

        /* Responsive Adjustments */
        @media (min-width: 768px) {
          .main-content {
            padding-top: 1rem;
          }
        }

        @media (min-width: 992px) {
          .main-content {
            padding-top: 1.5rem;
          }
        }

        /* Mobile Specific Styles */
        @media (max-width: 991.98px) {
          .navbar-brand {
            font-size: 1.1rem;
          }
          
          .brand-icon {
            width: 32px;
            height: 32px;
          }
        }

        /* Offcanvas Navigation Styles */
        .offcanvas-body .nav-link {
          padding: 0.75rem 1rem;
          color: #495057;
          border-radius: 0.25rem;
          margin-bottom: 0.25rem;
          transition: all 0.2s ease;
        }

        .offcanvas-body .nav-link:hover {
          background-color: #f8f9fa;
          color: #0d6efd;
        }

        .offcanvas-body .nav-link.active {
          background-color: #e9ecef;
          color: #0d6efd;
          font-weight: 500;
        }

        .sidebar-category {
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #6c757d;
          padding: 0.5rem 1rem;
          margin-bottom: 0.25rem;
          letter-spacing: 0.5px;
        }

        /* Offcanvas Navigation Styles */
        .offcanvas-body .nav-link {
          padding: 0.75rem 1rem;
          color: #495057;
          border-radius: 0.25rem;
          margin-bottom: 0.25rem;
          transition: all 0.2s ease;
        }

        .offcanvas-body .nav-link:hover {
          background-color: #f0f7ff;
          color: #0d6efd;
        }

        .offcanvas-body .nav-link.active {
          background-color: #e7f1ff;
          color: #0d6efd;
          font-weight: 500;
          border-left: 3px solid #0d6efd;
        }
        
        /* Enhanced nav items */
        .nav-item-custom {
          color: rgba(255, 255, 255, 0.85) !important;
          transition: all 0.3s ease;
          border: 1px solid transparent;
          font-weight: 500;
        }

        .nav-item-custom:hover {
          color: white !important;
          background: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .active-nav-item {
          color: white !important;
          background: rgba(255, 255, 255, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  );
};

export default Layout;