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
  CashStack,
} from "react-bootstrap-icons";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const TransactionList = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [filteredTransactions, setFilteredTransactions] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchTerm]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setTransactions(response.data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        navigate("/trading");
      } else {
        toast.error("Failed to fetch transactions");
      }
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    if (!searchTerm.trim()) {
      setFilteredTransactions(transactions);
    } else {
      const filtered = transactions.filter(
        (transaction) =>
          transaction.transactionType
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          transaction.accountNumber
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (transaction.destinationAccountNumber &&
            transaction.destinationAccountNumber
              .toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          transaction.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
      setFilteredTransactions(filtered);
    }
  };

  const handleDelete = (transaction) => {
    setTransactionToDelete(transaction);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE_URL}/transactions/${transactionToDelete.transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success("Transaction deleted successfully");
      fetchTransactions();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
      } else {
        toast.error("Failed to delete transaction");
      }
    } finally {
      setShowDeleteModal(false);
      setTransactionToDelete(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTransactionTypeColor = (type) => {
    switch (type) {
      case "DEPOSIT":
        return "success";
      case "WITHDRAWAL":
        return "danger";
      case "TRANSFER":
        return "info";
      default:
        return "secondary";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "success";
      case "PENDING":
        return "warning";
      case "FAILED":
        return "danger";
      default:
        return "secondary";
    }
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
        <h1>Transactions</h1>
        <Button
          as={Link}
          to="/transactions/new"
          variant="primary"
          className="d-flex align-items-center gap-2"
        >
          <CashStack />
          New Transaction
        </Button>
      </div>

      <div className="mb-4">
        <InputGroup>
          <InputGroup.Text>
            <Search />
          </InputGroup.Text>
          <Form.Control
            placeholder="Search transactions by type, account, destination account, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </div>

      {filteredTransactions.length === 0 ? (
        <Alert variant="info">
          No transactions found.{" "}
          {searchTerm && "Try adjusting your search terms."}
        </Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Account</th>
              <th>Description</th>
              <th>Status</th>
              <th>Date & Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.transactionId}>
                <td>{transaction.transactionId}</td>
                <td>
                  <Badge
                    bg={getTransactionTypeColor(transaction.transactionType)}
                  >
                    {transaction.transactionType}
                  </Badge>
                </td>
                <td>
                  <strong
                    className={
                      transaction.transactionType === "DEPOSIT"
                        ? "text-success"
                        : transaction.transactionType === "WITHDRAWAL"
                        ? "text-danger"
                        : "text-info"
                    }
                  >
                    {transaction.transactionType === "DEPOSIT"
                      ? "+"
                      : transaction.transactionType === "WITHDRAWAL"
                      ? "-"
                      : "↔"}
                    {formatCurrency(transaction.amount)}
                  </strong>
                </td>
                <td>
                  {transaction.transactionType === "TRANSFER" ? (
                    <div>
                      <div>
                        <strong>From: {transaction.accountNumber}</strong>
                      </div>
                      <div className="text-muted small">
                        To: {transaction.destinationAccountNumber || "N/A"}
                      </div>
                    </div>
                  ) : (
                    <strong>{transaction.accountNumber}</strong>
                  )}
                </td>
                <td>{transaction.description}</td>
                <td>
                  <Badge bg="success">COMPLETED</Badge>
                </td>
                <td>{formatDateTime(transaction.createdAt)}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() =>
                        navigate(
                          `/transactions/edit/${transaction.transactionId}`
                        )
                      }
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDelete(transaction)}
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
          Are you sure you want to delete this transaction?
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

export default TransactionList;
