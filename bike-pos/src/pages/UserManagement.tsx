import React, { useState, useEffect } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Button,
  Modal,
  Form,
  Badge,
  Alert,
  Spinner
} from 'react-bootstrap';
import {
  PeopleFill,
  Plus,
  PencilSquare,
  Trash,
  PersonCheck,
  PersonX
} from 'react-bootstrap-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { usersApi } from '../services/api';

interface User {
  _id: string;
  name: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  isActive: boolean;
  shopId: string;
  createdAt: string;
  lastLogin?: string;
}

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'cashier' as 'admin' | 'manager' | 'cashier',
    isActive: true
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // The backend automatically filters by shop ID for non-developer users
      const response = await usersApi.getAll();
      
      // Transform the response data to match our interface
      const transformedUsers = response.data.map((userData: any) => ({
        _id: userData._id,
        name: userData.name,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        isActive: userData.active !== false, // Handle both active and isActive fields
        shopId: userData.shopId?._id || userData.shopId,
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin
      }));
      
      setUsers(transformedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      showError('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const userData = {
        name: formData.name,
        username: formData.username,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive,
        ...(formData.password && { password: formData.password })
      };
      
      if (editingUser) {
        await usersApi.update(editingUser._id, userData);
        showSuccess('User updated successfully');
      } else {
        await usersApi.create({
          ...userData,
          password: formData.password // Password is required for new users
        });
        showSuccess('User created successfully');
      }
      
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to save user';
      showError(errorMessage);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive
    });
    setShowModal(true);
  };

  const handleDelete = async (userId: string) => {
    const targetUser = users.find(u => u._id === userId);
    if (!targetUser) {
      showError('User not found');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${targetUser.name}?`)) {
      return;
    }

    try {
      console.log('Attempting to delete user:', {
        userId,
        targetUser: targetUser.name,
        targetRole: targetUser.role,
        currentUser: user?.name,
        currentRole: user?.role,
        canDelete: canDeleteUser(targetUser)
      });

      await usersApi.delete(userId);
      showSuccess('User deleted successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      console.error('Error details:', {
        status: error?.response?.status,
        message: error?.response?.data?.message,
        data: error?.response?.data
      });
      
      const errorMessage = error?.response?.data?.message || 'Failed to delete user';
      showError(errorMessage);
    }
  };

  const handleToggleStatus = async (userId: string, isActive: boolean) => {
    try {
      await usersApi.toggleStatus(userId);
      showSuccess(`User ${isActive ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user status:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to update user status';
      showError(errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      email: '',
      password: '',
      role: 'cashier',
      isActive: true
    });
    setEditingUser(null);
  };

  const canDeleteUser = (targetUser: User) => {
    // Cannot delete yourself
    if (targetUser._id === user?._id) {
      return false;
    }
    
    // Admin can delete manager and cashier from same shop
    if (user?.role === 'admin') {
      return ['manager', 'cashier'].includes(targetUser.role);
    }
    
    // Manager can delete cashier from same shop
    if (user?.role === 'manager') {
      return targetUser.role === 'cashier';
    }
    
    // Developer can delete anyone
    if (user?.role === 'developer') {
      return true;
    }
    
    return false;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'danger';
      case 'manager': return 'warning';
      case 'cashier': return 'primary';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <Container fluid className="py-4">
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4 align-items-center">
        <Col>
          <h4 className="fw-bold mb-0 d-flex align-items-center">
            <PeopleFill className="me-2" />
            User Management
          </h4>
          <p className="text-muted mb-0">Manage shop users and their permissions</p>
        </Col>
        <Col xs="auto">
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="d-flex align-items-center"
          >
            <Plus className="me-1" />
            Add User
          </Button>
        </Col>
      </Row>

      {/* Users Table */}
      <Card>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0">
            <thead className="bg-light">
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((userData) => (
                <tr key={userData._id}>
                  <td>
                    <div className="fw-semibold">{userData.name}</div>
                  </td>
                  <td>{userData.username}</td>
                  <td>{userData.email}</td>
                  <td>
                    <Badge bg={getRoleBadgeVariant(userData.role)} className="text-capitalize">
                      {userData.role}
                    </Badge>
                  </td>
                  <td>
                    <Badge bg={userData.isActive ? 'success' : 'secondary'}>
                      {userData.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    {userData.lastLogin 
                      ? new Date(userData.lastLogin).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleEdit(userData)}
                        title="Edit User"
                      >
                        <PencilSquare size={14} />
                      </Button>
                      
                      <Button
                        variant={userData.isActive ? "outline-warning" : "outline-success"}
                        size="sm"
                        onClick={() => handleToggleStatus(userData._id, userData.isActive)}
                        title={userData.isActive ? "Deactivate User" : "Activate User"}
                      >
                        {userData.isActive ? <PersonX size={14} /> : <PersonCheck size={14} />}
                      </Button>
                      
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDelete(userData._id)}
                        disabled={!canDeleteUser(userData)}
                        title="Delete User"
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Add/Edit User Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingUser ? 'Edit User' : 'Add New User'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Full Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Role</Form.Label>
                  <Form.Select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    required
                  >
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>
                    {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                  </Form.Label>
                  <Form.Control
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Check
                  type="switch"
                  id="user-active"
                  label="Active User"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default UserManagement;
