import React, { useState, useEffect } from "react";
import {
  Table,
  InputGroup,
  Form,
  Modal,
  Spinner,
  Container,
  Button,
  Alert,
  Badge,
} from "react-bootstrap";
import {
  Pencil,
  Trash,
  Eye,
  Plus,
  Search,
  PersonPlus,
} from "react-bootstrap-icons";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { GlassCard } from "./ui/GlassCard";
import { GlassButton } from "./ui/GlassButton";

const CustomerList = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/customers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setCustomers(response.data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        navigate("/trading");
      } else {
        toast.error("Failed to fetch customers");
      }
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    if (!searchTerm.trim()) {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(
        (customer) =>
          customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.phone.includes(searchTerm)
      );
      setFilteredCustomers(filtered);
    }
  };

  const handleDelete = (customer) => {
    setCustomerToDelete(customer);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE_URL}/customers/${customerToDelete.customerId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success("Customer deleted successfully");
      fetchCustomers();
    } catch (error) {
      console.error("Error deleting customer:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
      } else {
        toast.error("Failed to delete customer");
      }
    } finally {
      setShowDeleteModal(false);
      setCustomerToDelete(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Customers</h1>
        <Button
          as={Link}
          to="/customers/new"
          variant="primary"
          className="d-flex align-items-center gap-2"
        >
          <PersonPlus />
          Add New Customer
        </Button>
      </div>

      <div className="mb-4">
        <InputGroup>
          <InputGroup.Text>
            <Search />
          </InputGroup.Text>
          <Form.Control
            placeholder="Search customers by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </div>

      {filteredCustomers.length === 0 ? (
        <Alert variant="info">
          No customers found. {searchTerm && "Try adjusting your search terms."}
        </Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Date of Birth</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.customerId}>
                <td>{customer.customerId}</td>
                <td>
                  <strong>
                    {customer.firstName} {customer.lastName}
                  </strong>
                </td>
                <td>{customer.email}</td>
                <td>{customer.phone}</td>
                <td>{customer.address}</td>
                <td>{formatDate(customer.dateOfBirth)}</td>
                <td>
                  <Badge bg={customer.isActive ? "success" : "danger"}>
                    {customer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td>{formatDate(customer.createdAt)}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() =>
                        navigate(`/customers/edit/${customer.customerId}`)
                      }
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDelete(customer)}
                    >
                      <Trash />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete customer{" "}
          <strong>
            {customerToDelete?.firstName} {customerToDelete?.lastName}
          </strong>
          ?
          <br />
          <small className="text-muted">This action cannot be undone.</small>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CustomerList;
