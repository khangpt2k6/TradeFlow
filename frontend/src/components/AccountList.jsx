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
import { Pencil, Trash, Eye, Plus, Search, Bank2 } from "react-bootstrap-icons";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const AccountList = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [filteredAccounts, setFilteredAccounts] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication status
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/trading");
      return;
    }
    setIsAuthenticated(true);
    fetchAccounts();
  }, [navigate]);

  useEffect(() => {
    filterAccounts();
  }, [accounts, searchTerm]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Handle both array and object responses
      let accountsData = [];
      if (Array.isArray(response.data)) {
        // If response is already an array
        accountsData = response.data;
      } else if (
        response.data &&
        response.data.accounts &&
        Array.isArray(response.data.accounts)
      ) {
        // If response is an object with accounts array
        accountsData = response.data.accounts;
      } else {
        // Fallback to empty array
        accountsData = [];
      }

      console.log("📤 Received accounts data:", accountsData);
      setAccounts(accountsData);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/trading");
        return;
      }
      toast.error("Failed to fetch accounts");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAccounts = () => {
    // Ensure accounts is always an array
    const accountsArray = Array.isArray(accounts) ? accounts : [];

    if (!searchTerm.trim()) {
      setFilteredAccounts(accountsArray);
    } else {
      const filtered = accountsArray.filter(
        (account) =>
          (account.accountNumber &&
            account.accountNumber
              .toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          (account.customerName &&
            account.customerName
              .toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          (account.accountType &&
            account.accountType
              .toLowerCase()
              .includes(searchTerm.toLowerCase()))
      );
      setFilteredAccounts(filtered);
    }
  };

  const handleDelete = (account) => {
    setAccountToDelete(account);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE_URL}/accounts/${accountToDelete.accountId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success("Account deleted successfully");
      fetchAccounts();
    } catch (error) {
      console.error("Error deleting account:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        navigate("/trading");
      } else {
        toast.error("Failed to delete account");
      }
    } finally {
      setShowDeleteModal(false);
      setAccountToDelete(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Redirecting...</p>
      </div>
    );
  }

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
        <h1>Accounts</h1>
        <Button
          as={Link}
          to="/accounts/new"
          variant="primary"
          className="d-flex align-items-center gap-2"
        >
          <Bank2 />
          Open New Account
        </Button>
      </div>

      <div className="mb-4">
        <InputGroup>
          <InputGroup.Text>
            <Search />
          </InputGroup.Text>
          <Form.Control
            placeholder="Search accounts by number, customer name, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </div>

      {filteredAccounts.length === 0 ? (
        <Alert variant="info">
          No accounts found. {searchTerm && "Try adjusting your search terms."}
        </Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Account ID</th>
              <th>Account Number</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((account) => (
              <tr key={account.accountId}>
                <td>{account.accountId}</td>
                <td>
                  <strong>{account.accountNumber}</strong>
                </td>
                <td>{account.customerName}</td>
                <td>
                  <Badge
                    bg={account.accountType === "SAVINGS" ? "info" : "primary"}
                  >
                    {account.accountType}
                  </Badge>
                </td>
                <td>
                  <strong
                    className={
                      account.balance >= 0 ? "text-success" : "text-danger"
                    }
                  >
                    {formatCurrency(account.balance)}
                  </strong>
                </td>
                <td>
                  <Badge
                    bg={account.status === "ACTIVE" ? "success" : "danger"}
                  >
                    {account.status === "ACTIVE" ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td>{formatDate(account.createdAt)}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() =>
                        navigate(`/accounts/edit/${account.accountId}`)
                      }
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDelete(account)}
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
          Are you sure you want to delete account{" "}
          <strong>{accountToDelete?.accountNumber}</strong>?
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

export default AccountList;
